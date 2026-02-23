/** Generate ratio for import */
function writeJsonToCell() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  let obj = {};

  // Loop through rows, skipping the header row
  for (let i = 2; i < data.length; i++) {
    const key = data[i][0];    // Column A (index 0)
    const value = data[i][12]; // Column N (index 13)

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
  sheet.getRange("S7").setValue(base64String);
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

  // Read all rows from row 2 to lastRow
  const dataRange = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
  const rows = dataRange.getValues();

  const allItems = []; // array of {date, player, itemID, itemName} objects
  const playerSet = new Set(); // to collect unique player names

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

      let player = record.player || record.owner || '';
      // remove suffix -Thunderstrike if present
      player = player.replace(/-Thunderstrike$/i, '');
      
      const itemName = record.itemName || record.item || '';
      const itemID = record.itemID || '';
      const date = formatDate(record.date || '');

      allItems.push({
        date: date,
        player: player,
        itemID: itemID,
        itemName: itemName
      });

      playerSet.add(player);
    }
  }

  // Populate loot_details sheet
  populateLootDetails(ss, allItems, Array.from(playerSet).sort());

  // Update loot counts in ratio sheet
  updateLootCounts(ss, allItems);

  Logger.log('Processed ' + allItems.length + ' items.');
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
  if (itemName.startsWith('Pattern')) {
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
    // Clear existing content
    detailsSheet.clearContents();
  }

  if (sortedPlayers.length === 0 || allItems.length === 0) {
    Logger.log('No players or items to populate.');
    return;
  }

  // Row 1: Player names (merged across 3 columns each)
  // Row 2: Fixed headers ('raid_date', 'item_name', 'item_id')
  // Row 3+: One row per item

  // Each player takes 3 columns
  const numCols = sortedPlayers.length * 3;

  // Write row 1: player names with 3-row merge
  const row1Values = [];
  for (let i = 0; i < sortedPlayers.length; i++) {
    row1Values.push(sortedPlayers[i]);
    row1Values.push('');
    row1Values.push('');
  }
  detailsSheet.getRange(1, 1, 1, numCols).setValues([row1Values]);

  // Merge cells for player names (3 cells per player)
  for (let i = 0; i < sortedPlayers.length; i++) {
    const startCol = i * 3 + 1;
    detailsSheet.getRange(1, startCol, 1, 3).merge();
  }

  // Write row 2: fixed headers
  const row2Values = [];
  for (let i = 0; i < sortedPlayers.length; i++) {
    row2Values.push('raid_date');
    row2Values.push('item_name');
    row2Values.push('item_id');
  }
  detailsSheet.getRange(2, 1, 1, numCols).setValues([row2Values]);

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

      // Get the item for this column triplet (if exists)
      if (itemIdx < playerItems.length) {
        const playerItem = playerItems[itemIdx];
        rowValues.push(playerItem.date || '');
        rowValues.push(playerItem.itemName || '');
        rowValues.push(playerItem.itemID || '');
      } else {
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
  }

  Logger.log('Loot details sheet populated with ' + rowData.length + ' rows.');
}

/** Update loot counts in the Ratio Présence/Loot (Préloot) sheet */
function updateLootCounts(ss, allItems) {
  const ratioSheet = ss.getSheetByName('Ratio Présence/Loot (Préloot)');
  
  if (!ratioSheet) {
    Logger.log('Ratio Présence/Loot (Préloot) sheet not found.');
    return;
  }

  // Create a map of player -> loot count
  const lootCountMap = {};
  for (let i = 0; i < allItems.length; i++) {
    const player = allItems[i].player;
    lootCountMap[player] = (lootCountMap[player] || 0) + 1;
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

    // Fetch attendance data from Warcraft Logs
    const attendees = fetchWarcraftLogsAttendance(raidCode);
    
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

/** Fetch attendance data from Warcraft Logs API */
function fetchWarcraftLogsAttendance(raidCode) {
  // TODO: Implement Warcraft Logs API call
  // This requires:
  // 1. Warcraft Logs API key (client_id and client_secret)
  // 2. Understanding the API endpoint for raid reports
  // 
  // Example structure (placeholder):
  // - Make HTTP request to Warcraft Logs API with raidCode
  // - Parse response to extract player names
  // - Return array of attending player names
  
  try {
    // Placeholder: return empty array for now
    Logger.log('fetchWarcraftLogsAttendance called with code: ' + raidCode);
    return [];
  } catch (e) {
    Logger.log('Error fetching attendance for code ' + raidCode + ': ' + e.message);
    return [];
  }
}

/** Update attendance counts in the Ratio Présence/Loot (Préloot) sheet */
function updateAttendanceCounts(ss, attendanceMap) {
  const ratioSheet = ss.getSheetByName('Ratio Présence/Loot (Préloot)');
  
  if (!ratioSheet) {
    Logger.log('Ratio Présence/Loot (Préloot) sheet not found.');
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
