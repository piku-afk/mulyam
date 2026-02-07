# Mulyam - know you worth

Phase 1: use the excel from groww app, manually upload to the app and view the insights.

1. parse the excel file
   - an input field where user can upload the excel file
   - use a library like `xlsx` to read the excel file and extract the data
2. create a json data
3. render the insights on the app

Phase 2: automate the process of fetching the excel/pdf file from groww/cams online app and parsing it to json data.

1. download the file from source at a specific time
2. upload the file
3. parse the file and save the data in database
4. render the insights on the app

Phase 3: similarly, automate the process for stock holdings and investments

1. find a source to download the file, right now it is groww app.
   - get the data file from a source
   - parse the file and save the data in database
   - render the insights on the app

Phase 4: now start parsing bank, credit statements

1. get banks statements from emails or generate one from the bank app
2. parse the file and save the data in database
3. render the insights on the app
