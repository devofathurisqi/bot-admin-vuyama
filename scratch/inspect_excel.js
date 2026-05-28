const XLSX = require('xlsx');
const path = require('path');

const inspectExcel = () => {
  const excelPath = path.join(__dirname, '../learn/vuyama_data.xlsx');
  const workbook = XLSX.readFile(excelPath);
  
  console.log('Available sheets:', workbook.SheetNames);
  
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);
    console.log(`\n--- Sheet: ${sheetName} ---`);
    if (data.length > 0) {
      console.log('Columns:', Object.keys(data[0]));
      console.log('Sample row:', data[0]);
    } else {
      console.log('Sheet is empty');
    }
  });
};

inspectExcel();
