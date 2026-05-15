/** Generate ratio for import */
function writeJsonToCell() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  let obj = {};

  // Loop through rows, skipping the header row
  for (let i = 2; i < data.length; i++) {
    const key = data[i][0];    // Column A (index 0)
    const value = data[i][9].toFixed(3); // Column J (index 9)    

    Logger.log(`Ligne ${i+1} | key="${key}" | value="${value}"`);

    // Make sure the key exists, but allow value = 0
    if (key !== "" && key !== null && value !== "" && value !== null) {
      obj[key] = value;
    }
  }

  const jsonString = JSON.stringify(obj, null, 2);
  
  // Create blob and base64 encode directly
  const blob = Utilities.newBlob(jsonString, 'text/plain');
  const base64String = Utilities.base64Encode(blob.getBytes());

  // Write the JSON into cell U3
  Logger.log("Base64 généré : " + base64String);
  sheet.getRange("P2").setValue(base64String);
  Logger.log("Écriture effectuée");
}

/** Process raid logs sheets export */
function process_raid_logs_loots() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('raid_logs');
  
  if (!sheet) {
    Logger.log('raid_logs sheet not found.');
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('No data rows found.');
    return;
  }

  const colC = 3; // column C (JSON payload)

  // Load prio item IDs (items with coeff 0)
  const prioIds = getPrioItemIds();
  const rosterPlayers = getRatioPresenceRoster(ss);
  if (rosterPlayers === null) {
    Logger.log('Skipping loot processing: Ratio Présence roster sheet not found.');
    return;
  }

  // Read all rows from row 2 to lastRow
  const dataRange = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
  const rows = dataRange.getValues();

  const allItems = []; // array of {date, player, itemID, itemName} objects
  const playerSet = new Set(); // to collect unique player names
  let skippedNonRosterItems = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowIndex = i + 2; // actual sheet row
    const cCell = rows[i][colC - 1];
    if (!cCell) {
      // nothing to parse
      continue;
    }

    let parsed = null;
    try {
      parsed = JSON.parse(cCell);
    } catch (e) {
      try {
        // fallback: attempt to evaluate object-like text
        parsed = eval('(' + cCell + ')');
      } catch (e2) {
        // unable to parse, skip
        Logger.log('Skipping row ' + rowIndex + ': invalid JSON');
        continue;
      }
    }

    if (!parsed) continue;

    // Handle both array and object
    const records = Array.isArray(parsed) ? parsed : [parsed];

    for (let j = 0; j < records.length; j++) {
      const record = records[j];
      
      if (!shouldProcessRecord(record)) {
        continue;
      }

      const playerKey = getRosterPlayerKey(record.player || record.owner || '');
      if (!rosterPlayers.has(playerKey)) {
        skippedNonRosterItems++;
        continue;
      }

      const player = rosterPlayers.get(playerKey);
      
      const itemName = record.itemName || record.item || '';
      const itemID = record.itemID || '';
      const date = formatDate(record.date || '');

      // determine coefficient based on instance
      let coeff = 1;
      if (record.instance && typeof record.instance === 'string') {
        if (record.instance.includes('Kara') ||
            record.instance.includes('Gruul') ||
            record.instance.includes('Magh')
          ) {
          const recordDate = new Date(record.date);
          const p2StartDate = new Date('2026-05-12');

          if (recordDate > p2StartDate) {
            coeff = 0.33;
          } else {
            coeff = 1;
          }
        }
        else{
          coeff = 1
        }
      }

      // Check if item is in prio list (coefficient 0)
      if (prioIds.has(String(itemID))) {
        coeff = 0;
      }

      allItems.push({
        date: date,
        player: player,
        itemID: itemID,
        itemName: itemName,
        coeff: coeff
      });

      playerSet.add(player);
    }
  }

  // Populate loot_details sheet
  populateLootDetails(ss, allItems, Array.from(playerSet).sort());

  // Update loot counts in ratio sheet
  updateLootCounts(ss, allItems);

  Logger.log('Processed ' + allItems.length + ' items. Skipped ' + skippedNonRosterItems + ' non-roster items.');
}

function getRatioPresenceSheet(ss) {
  const sheet = ss.getSheetByName('Ratio Présence/Loot (Préloot)');
  if (!sheet) {
    Logger.log('Ratio Présence/Loot (Préloot) sheet not found.');
  }

  return sheet;
}

function normalizePlayerName(playerName) {
  const player = String(playerName || '')
    .trim()
    .replace(/-Thunderstrike$/i, '');

  if (!player) {
    return '';
  }

  return player.charAt(0).toUpperCase() + player.slice(1);
}

function getRosterPlayerKey(playerName) {
  return normalizePlayerName(playerName).toLowerCase();
}

function getRatioPresenceRoster(ss) {
  const ratioSheet = getRatioPresenceSheet(ss);

  if (!ratioSheet) {
    return null;
  }

  const lastRow = ratioSheet.getLastRow();
  if (lastRow < 3) {
    Logger.log('No player rows found in ratio sheet roster (need at least row 3).');
    return new Map();
  }

  const playerRange = ratioSheet.getRange(3, 1, lastRow - 2, 1);
  const playerNames = playerRange.getValues();
  const rosterPlayers = new Map();

  for (let i = 0; i < playerNames.length; i++) {
    const playerName = normalizePlayerName(playerNames[i][0]);
    const playerKey = getRosterPlayerKey(playerName);

    if (playerName && !rosterPlayers.has(playerKey)) {
      rosterPlayers.set(playerKey, playerName);
    }
  }

  Logger.log('Loaded ' + rosterPlayers.size + ' roster players from Ratio Présence.');
  return rosterPlayers;
}

/** Get all prio item IDs from the "Prio items" sheet (column X) */
function getPrioItemIds() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const prioSheet = ss.getSheetByName('Prio items');
  
  if (!prioSheet) {
    Logger.log('Prio items sheet not found.');
    return new Set();
  }

  const colX = 24; // column X
  const lastRow = prioSheet.getLastRow();
  
  if (lastRow < 2) {
    return new Set();
  }

  // Read column X from row 2 onwards
  const range = prioSheet.getRange(2, colX, lastRow - 1, 1);
  const values = range.getValues();
  
  const prioIds = new Set();
  for (let i = 0; i < values.length; i++) {
    const itemId = values[i][0];
    if (itemId && itemId !== '') {
      prioIds.add(String(itemId)); // convert to string for comparison
    }
  }
  
  Logger.log('Loaded ' + prioIds.size + ' prio item IDs');
  return prioIds;
}

/** Check if a record should be processed */
function shouldProcessRecord(record) {
  // Must have responseID = 1
  if (String(record.responseID) !== '1') {
    return false;
  }
  
  // Skip disenchant responses
  if (record.response === 'Désenchantement' || record.response === 'Disenchant') {
    return false;
  }
  
  // Skip patterns
  const itemName = record.itemName || record.item || '';
  if (itemName.startsWith('Pattern') || itemName.startsWith('Design')) {
    return false;
  }
  
  return true;
}

/** Format date to dd/MM/yyyy format */
function formatDate(dateStr) {
  if (!dateStr) return '';
  
  try {
    // Handle yyyy/MM/dd format
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1];
      const day = parts[2];
      return day + '/' + month + '/' + year;
    }
  } catch (e) {
    Logger.log('Error formatting date: ' + dateStr);
  }
  
  return dateStr;
}

function populateLootDetails(ss, allItems, sortedPlayers) {
  // Get or create loot_details sheet
  let detailsSheet = ss.getSheetByName('loot_details');
  if (!detailsSheet) {
    detailsSheet = ss.insertSheet('loot_details');
  } else {
    // Clear existing content and remove any merges/formats
    detailsSheet.clear();
  }

  if (sortedPlayers.length === 0 || allItems.length === 0) {
    Logger.log('No players or items to populate.');
    return;
  }

  // Row 1: Player names (merged across 3 columns each)
  // Row 2: Fixed headers ('raid_date', 'item_name', 'item_id')
  // Row 3+: One row per item

  // Each player takes 4 columns now (raid_date, item_name, item_id, coeff)
  const numCols = sortedPlayers.length * 4;

  // Write row 1: player names with 4-column merge
  const row1Values = [];
  for (let i = 0; i < sortedPlayers.length; i++) {
    row1Values.push(sortedPlayers[i]);
    row1Values.push('');
    row1Values.push('');
    row1Values.push('');
  }
  detailsSheet.getRange(1, 1, 1, numCols).setValues([row1Values]);

  // Merge cells for player names (4 cells per player)
  for (let i = 0; i < sortedPlayers.length; i++) {
    const startCol = i * 4 + 1;
    detailsSheet.getRange(1, startCol, 1, 4).merge();
  }

  // Write row 2: fixed headers
  const row2Values = [];
  for (let i = 0; i < sortedPlayers.length; i++) {
    row2Values.push('raid_date');
    row2Values.push('item_name');
    row2Values.push('item_id');
    row2Values.push('coeff');
  }
  detailsSheet.getRange(2, 1, 1, numCols).setValues([row2Values]);

  // Style headers (rows 1-2): bold and light grey background
  detailsSheet.getRange(1, 1, 2, numCols)
    .setFontWeight('bold')
    .setBackground('#073763') // dark blue background for better contrast
    .setFontColor('#FFFFFF') // white font color for better contrast
    .setHorizontalAlignment('center');
  // Set player name row1 font size 18, rest font 10
  detailsSheet.getRange(1, 1, 1, numCols).setFontSize(18);
  detailsSheet.getRange(2, 1, 1, numCols).setFontSize(10);

  // Optionally adjust column widths for readability
  // raid_date narrower, item_name wide, item_id normal, coeff smaller
  for (let p = 0; p < sortedPlayers.length; p++) {
    const base = p * 4;
    detailsSheet.setColumnWidth(base + 1, 75); // raid_date
    detailsSheet.setColumnWidth(base + 2, 200); // item_name
    detailsSheet.setColumnWidth(base + 3, 50);  // item_id
    detailsSheet.setColumnWidth(base + 4, 35);  // coeff
  }

  // Build row data (starting from row 3)
  const rowData = [];
  for (let itemIdx = 0; itemIdx < allItems.length; itemIdx++) {
    const item = allItems[itemIdx];
    const rowValues = [];

    for (let playerIdx = 0; playerIdx < sortedPlayers.length; playerIdx++) {
      const playerName = sortedPlayers[playerIdx];

      // Find all items for this player
      const playerItems = allItems.filter(
        x => x.player === playerName && x.itemID !== '' && x.itemName !== ''
      );

      // Get the item for this column quadruplet (if exists)
      if (itemIdx < playerItems.length) {
        const playerItem = playerItems[itemIdx];
        rowValues.push(playerItem.date || '');
        rowValues.push(playerItem.itemName || '');
        rowValues.push(playerItem.itemID || '');
        rowValues.push(playerItem.coeff != null ? playerItem.coeff : '');
      } else {
        rowValues.push('');
        rowValues.push('');
        rowValues.push('');
        rowValues.push('');
      }
    }

    rowData.push(rowValues);
  }

  // Write all data rows
  if (rowData.length > 0) {
    detailsSheet.getRange(3, 1, rowData.length, numCols).setValues(rowData);

    // Apply formatting: raid_date as plain text, item_id and coeff as numbers
    for (let p = 0; p < sortedPlayers.length; p++) {
      const raidDateCol = p * 4 + 1;
      const itemNameCol = p * 4 + 2;
      const itemIdCol = p * 4 + 3;
      const coeffCol = p * 4 + 4;
      // set raid_date column as text to prevent automatic date parsing
      detailsSheet.getRange(3, raidDateCol, rowData.length, 1).setNumberFormat('@');
      // set item_id and coeff columns as integer
      detailsSheet.getRange(3, itemIdCol, rowData.length, 1).setNumberFormat('0');
      detailsSheet.getRange(3, coeffCol, rowData.length, 1).setNumberFormat('0.00');
      // add vertical separator right border after each player block
      const sepCol = coeffCol;
      detailsSheet.getRange(1, sepCol, rowData.length + 2, 1)
        // apply right border (after coeff column) instead of left
        .setBorder(null, null, null, true, null, null, 'black', SpreadsheetApp.BorderStyle.SOLID);
    }
  }

  Logger.log('Loot details sheet populated with ' + rowData.length + ' rows.');
}

/** Update loot counts in the Ratio Présence/Loot (Préloot) sheet */
function updateLootCounts(ss, allItems) {
  const ratioSheet = getRatioPresenceSheet(ss);
  
  if (!ratioSheet) {
    return;
  }

  // Create a map of player -> weighted loot count (coeff applied)
  const lootCountMap = {};
  for (let i = 0; i < allItems.length; i++) {
    const player = allItems[i].player;
    const coeff = allItems[i].coeff != null ? allItems[i].coeff : 1;
    lootCountMap[player] = (lootCountMap[player] || 0) + coeff;
  }

  // Get all data from the ratio sheet
  const lastRow = ratioSheet.getLastRow();
  if (lastRow < 3) {
    Logger.log('No player rows found in ratio sheet (need at least row 3).');
    return;
  }

  // Read player names from column A starting at row 3 (skip rows 1 and 2)
  const playerRange = ratioSheet.getRange(3, 1, lastRow - 2, 1);
  const playerNames = playerRange.getValues();

  // Update column H with loot counts
  for (let i = 0; i < playerNames.length; i++) {
    const playerName = playerNames[i][0];
    if (playerName && playerName.trim() !== '') {
      const lootCount = lootCountMap[playerName] || 0;
      const rowIndex = i + 3; // actual sheet row (starting from row 3)
      ratioSheet.getRange(rowIndex, 8).setValue(lootCount); // Column H = column 8
    }
  }

  Logger.log('Updated loot counts in ratio sheet.');
}

/** Get attendance from Warcraft Logs using raid code */
function getAttendanceFromWarcraftLogs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('raid_logs');
  
  if (!sheet) {
    Logger.log('raid_logs sheet not found.');
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('No data rows found.');
    return;
  }

  const colD = 4; // column D (Warcraft Logs raid code)

  // Read all rows from row 2 to lastRow
  const dataRange = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
  const rows = dataRange.getValues();

  const attendanceMap = {}; // map of player -> attended raids count

  for (let i = 0; i < rows.length; i++) {
    const rowIndex = i + 2; // actual sheet row
    const raidCode = rows[i][colD - 1];
    
    if (!raidCode) {
      Logger.log('Row ' + rowIndex + ': No raid code found.');
      continue;
    }

    Logger.log('Row ' + rowIndex + ': Processing raid code: ' + raidCode);

    // Try GuildAttendance (v2) first, fall back to report-based fetch
    let attendees = fetchWarcraftLogsGuildAttendance(raidCode);
    if (!attendees || attendees.length === 0) {
      attendees = fetchWarcraftLogsAttendance(raidCode);
    }

    if (!attendees || attendees.length === 0) {
      Logger.log('Row ' + rowIndex + ': No attendance data found for code: ' + raidCode);
      continue;
    }

    // Add attendees to map
    for (let j = 0; j < attendees.length; j++) {
      const playerName = attendees[j];
      attendanceMap[playerName] = (attendanceMap[playerName] || 0) + 1;
    }

    Logger.log('Row ' + rowIndex + ': Found ' + attendees.length + ' attendees.');
  }

  // Update attendance in ratio sheet
  updateAttendanceCounts(ss, attendanceMap);

  Logger.log('Attendance processing complete.');
}

/** Fetch credentials from warcraft_logs_credentials sheet */
function getWarcraftLogsCredentials() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const credSheet = ss.getSheetByName('warcraft_logs_credentials');
  
  if (!credSheet) {
    Logger.log('warcraft_logs_credentials sheet not found.');
    return null;
  }
  
  try {
    const clientId = credSheet.getRange('B1').getValue();
    const clientSecret = credSheet.getRange('B2').getValue();
    
    if (!clientId || !clientSecret) {
      Logger.log('Credentials not properly configured in warcraft_logs_credentials sheet.');
      return null;
    }
    
    return {
      clientId: clientId,
      clientSecret: clientSecret
    };
  } catch (e) {
    Logger.log('Error reading credentials: ' + e.message);
    return null;
  }
}

/** Fetch attendance data from Warcraft Logs API v2 */
function fetchWarcraftLogsAttendance(raidCode) {
  const credentials = getWarcraftLogsCredentials();
  
  if (!credentials) {
    Logger.log('Could not retrieve Warcraft Logs credentials.');
    return [];
  }

  try {
    // Get access token
    const token = getWarcraftLogsToken(credentials);
    
    if (!token) {
      Logger.log('Failed to obtain access token.');
      return [];
    }

    // Fetch raid report data using v2 API
    const query = `
      query {
        reportData {
          report(code: "${raidCode}", guildId: 795902) {
            title
            startTime
            endTime
            masterData {
              actors(type: "player") {
                id
                name
                type
              }
            }
          }
        }
      }
    `;

    const options = {
      method: 'post',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify({ query: query }),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch('https://www.warcraftlogs.com/api/v2/client', options);
    const result = JSON.parse(response.getContentText());

    if (response.getResponseCode() !== 200) {
      Logger.log('Warcraft Logs API error: ' + response.getResponseCode() + ' - ' + response.getContentText());
      return [];
    }

    if (result.errors) {
      Logger.log('GraphQL errors: ' + JSON.stringify(result.errors));
      return [];
    }

    // Extract player names from report
    if (result.data && result.data.reportData && result.data.reportData.report) {
      const report = result.data.reportData.report;
      const actors = report.masterData.actors;
      
      const attendees = [];
      for (let i = 0; i < actors.length; i++) {
        const actor = actors[i];
        if (actor.type === 'player' && actor.name) {
          attendees.push(actor.name);
        }
      }
      
      Logger.log('Found ' + attendees.length + ' attendees for raid ' + raidCode);
      return attendees;
    }

    return [];
  } catch (e) {
    Logger.log('Error fetching attendance for code ' + raidCode + ': ' + e.message);
    return [];
  }
}

/** Get access token from Warcraft Logs OAuth */
function getWarcraftLogsToken(credentials) {
  try {
    const payload = {
      grant_type: 'client_credentials',
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret
    };

    const options = {
      method: 'post',
      payload: payload,
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch('https://www.warcraftlogs.com/oauth/token', options);
    
    if (response.getResponseCode() !== 200) {
      Logger.log('OAuth error: ' + response.getResponseCode() + ' - ' + response.getContentText());
      return null;
    }

    const result = JSON.parse(response.getContentText());
    return result.access_token;
  } catch (e) {
    Logger.log('Error obtaining access token: ' + e.message);
    return null;
  }
}

/** Fetch guild attendance using GuildAttendance (v2) */
function fetchWarcraftLogsGuildAttendance(raidCode) {
  const credentials = getWarcraftLogsCredentials();
  if (!credentials) {
    Logger.log('Could not retrieve Warcraft Logs credentials.');
    return [];
  }

  const token = getWarcraftLogsToken(credentials);
  if (!token) {
    Logger.log('Failed to obtain access token for GuildAttendance.');
    return [];
  }

  try {
    const query = `
      query {
        guildAttendance(code: "${raidCode}") {
          code
          startTime
          players {
            name
          }
          zone {
            id
            name
          }
        }
      }
    `;

    const options = {
      method: 'post',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify({ query: query }),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch('https://www.warcraftlogs.com/api/v2/client', options);
    if (response.getResponseCode() !== 200) {
      Logger.log('GuildAttendance API error: ' + response.getResponseCode() + ' - ' + response.getContentText());
      return [];
    }

    const result = JSON.parse(response.getContentText());
    if (result.errors) {
      Logger.log('GuildAttendance GraphQL errors: ' + JSON.stringify(result.errors));
      return [];
    }

    if (result.data && result.data.guildAttendance && result.data.guildAttendance.players) {
      const players = result.data.guildAttendance.players;
      const attendees = players.map(p => p.name).filter(n => n);
      Logger.log('GuildAttendance: found ' + attendees.length + ' players for code ' + raidCode);
      return attendees;
    }

    return [];
  } catch (e) {
    Logger.log('Error fetching GuildAttendance for code ' + raidCode + ': ' + e.message);
    return [];
  }
}

/** Update attendance counts in the Ratio Présence/Loot (Préloot) sheet */
function updateAttendanceCounts(ss, attendanceMap) {
  const ratioSheet = getRatioPresenceSheet(ss);
  
  if (!ratioSheet) {
    return;
  }

  // Get all data from the ratio sheet
  const lastRow = ratioSheet.getLastRow();
  if (lastRow < 3) {
    Logger.log('No player rows found in ratio sheet (need at least row 3).');
    return;
  }

  // Read player names from column A starting at row 3 (skip rows 1 and 2)
  const playerRange = ratioSheet.getRange(3, 1, lastRow - 2, 1);
  const playerNames = playerRange.getValues();

  // Update column G with attendance counts (or choose your target column)
  for (let i = 0; i < playerNames.length; i++) {
    const playerName = playerNames[i][0];
    if (playerName && playerName.trim() !== '') {
      const attendanceCount = attendanceMap[playerName] || 0;
      const rowIndex = i + 3; // actual sheet row (starting from row 3)
      ratioSheet.getRange(rowIndex, 7).setValue(attendanceCount); // Column G = column 7
    }
  }

  Logger.log('Updated attendance counts in ratio sheet.');
}
