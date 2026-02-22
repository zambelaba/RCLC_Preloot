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
