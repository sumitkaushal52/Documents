'use strict';
console.log("Inside CitiReq JS file");
var fieldMap = new Map();
var fieldName = "";
var fieldValues = "";
const unregisterHandlerFunctions = [];
var selectedOptions = "";
var enteredUrl = "";
// to ensure that JavaScript code doesn't run before the necessary HTML elements are available in the DOM
document.addEventListener("DOMContentLoaded", () => {
    console.log("HTML has been loaded");
    try {
        tableau.extensions.initializeAsync({ 'configure': configure }).then(function () {
            console.log("Initialization completed.");
            const dialogOptions = {
                "width": 400,
                "height": 300
            };
            var savedDataFromEx = "";
            if (tableau.extensions.settings) {
                var currSettingObj = tableau.extensions.settings.getAll();

                try {
                    if (currSettingObj.savedData != undefined) {
                        savedDataFromEx = JSON.parse(currSettingObj.savedData);
                    }
                    if (savedDataFromEx) { //.hasOwnProperty("selectedOptions")
                        console.log("Congif data is already SAVED");
                        let selectedOptions = savedDataFromEx.selectedOptions;
                        let enteredUrl = savedDataFromEx.enteredUrl;
                        createButton(selectedOptions, enteredUrl);

                    } else {
                        console.log("Congif data NOT SAVED yet");
                        tableau.extensions.ui.displayDialogAsync("dialog.html", "", dialogOptions)
                            .then(function (closePayload) {
                                console.log("Dialog closed with payload:", closePayload);
                                // Handling the dialog's response here
                                if (closePayload !== null) {
                                    console.log("Dialog Window is closed now");
                                    // Handle the saved data here
                                    selectedOptions = closePayload.input1;
                                    enteredUrl = closePayload.input2;

                                    let savedData = {
                                        selectedOptions,
                                        enteredUrl
                                    }
                                    tableau.extensions.settings.set('savedData', JSON.stringify(savedData));
                                    tableau.extensions.settings.saveAsync().then((newSavedSettings) => {
                                        console.log("Settings Saved: ", newSavedSettings);
                                    });
                                    // Create a button with the saved data
                                    createButton(selectedOptions, enteredUrl);
                                }
                            })
                            .catch(function (error) {
                                console.log("Error opening dialog:", error);
                            });
                    }
                } catch (e) {
                    console.log("Error before setting config data: ", e);
                }
            }
        })
            .catch(function (error) {
                console.error("Inside initialization's catch:", error);
            });
    } catch (error) {
        console.log("Initialization error:", error);
    }

});




function fetchFilters() {
    console.log("Inside Fetch Filters");

    return new Promise(function (resolve, reject) {
        // Your fetchFilters() logic, which may involve asynchronous operations
        // Resolve the Promise when fetchFilters() is completed
        unregisterHandlerFunctions.forEach(function (unregisterHandlerFunction) {
            unregisterHandlerFunction();
        });

        // console.log("Inside Fetch Filters");
        const filterFetchPromises = [];
        const dashboardfilters = [];
        const dashboard = tableau.extensions.dashboardContent.dashboard;
        // filterFetchPromises.push(dashboard.getFiltersAsync());
        dashboard.worksheets.forEach(function (worksheet) {
            filterFetchPromises.push(worksheet.getFiltersAsync());
            // Add filter event to each worksheet.  AddEventListener returns a function that will
            // remove the event listener when called.
            const unregisterHandlerFunction = worksheet.addEventListener(tableau.TableauEventType.FilterChanged, filterChangedHandler);
            unregisterHandlerFunctions.push(unregisterHandlerFunction);
        });

        Promise.all(filterFetchPromises).then(function (fetchResults) {
            fetchResults.forEach(function (filtersForWorksheet) {
                filtersForWorksheet.forEach(function (filter) {
                    dashboardfilters.push(filter);
                });
            });
            // console.log("Dashboard Filters: ",dashboardfilters);
            buildFiltersTable(dashboardfilters);
        });
        // console.log("filterFetchPromise:", filterFetchPromises);
        resolve();
    });
}

function getselectedMark(worksheetNames) {
    // console.log("-- Inside getSelectedMark --",worksheetNames);
    const worksheets = tableau.extensions.dashboardContent.dashboard.worksheets;

    let selectedMarks = new Map();
    let mappedData = [];
    worksheets.forEach(worksheet => {
        var worksheetName = worksheet.name;
        worksheet.getSelectedMarksAsync().then(function (marks) {
            console.log(`Selected marks for worksheet ${worksheet.name}:`, marks);
            const worksheetData = marks.data[0];
            // console.log("-- worksheetData --", worksheetData);
            const data = worksheetData.data.map(function (row, index) {
                const rowData = row.map(function (cell) {
                    return cell.formattedValue;
                });
                return rowData;
            });
            const columns = worksheetData.columns.map(function (column) {
                return {
                    title: column.fieldName
                };
            });
            // console.log("-- Columns --", columns);
            // console.log("-- data --", data);
            for (let i = 0; i <= columns.length; i++) {
                let column = columns[i].title;
                let value = data[0][i];
                let temObj = { key: column, value: value, worksheetName }
                //if(column != "AsUser" && column != "Measure Names" && column != "Measure Values" && isNaN(value)) {
                mappedData.push(temObj);
                //}                
            }
        }).catch(function (error) {
            console.error(`Error fetching selected marks for worksheet ${worksheet.name}:`, error);
        });
    });
    // console.log("----> ",mappedData);
    return mappedData;
}

// This is a handling function that is called anytime a filter is changed in Tableau.
function filterChangedHandler(filterEvent) {
    // Just reconstruct the filters table whenever a filter changes.
    // This could be optimized to add/remove only the different filters.
    console.log("Some Filter value is changed");
    fetchFilters();
    // createButton(selectedOptions, enteredUrl);

}

function buildFiltersTable(filters) {
    filters.forEach(function (filter) {
        fieldName = filter.fieldName;
        const valueStr = getFilterValues(filter);
        fieldValues = valueStr;
        // console.log("Filed Name --> ", filter.fieldName);
        // console.log("Filed value --> ", valueStr);
        if (fieldMap.has(fieldName)) {
            // If it exists, override the values
            fieldMap.set(fieldName, fieldValues);
        } else {
            // If it doesn't exist, add a new entry
            fieldMap.set(fieldName, fieldValues);
        }
    });

}

function getFilterValues(filter) {
    // console.log("Inside GetFilterValues method");
    let filterValues = '';
    // console.log("filter --> ",filter);
    switch (filter.filterType) {
        case 'categorical':
            // console.log("appliesValues -- >", filter.appliedValues);
            filter.appliedValues.forEach(function (value) {
                filterValues += value.formattedValue + ', ';
            });
            break;
        case 'range':
            // A range filter can have a min and/or a max.
            if (filter.minValue) {
                filterValues += 'min: ' + filter.minValue.formattedValue + ', ';
            }
            if (filter.maxValue) {
                filterValues += 'max: ' + filter.maxValue.formattedValue + ', ';
            }
            break;
        case 'relative-date':
            filterValues += 'Period: ' + filter.periodType + ', ';
            filterValues += 'RangeN: ' + filter.rangeN + ', ';
            filterValues += 'Range Type: ' + filter.rangeType + ', ';
            break;
        default:
    }
    // Cut off the trailing ", "
    return filterValues.slice(0, -2);
}

function configure() {
    // console.log("Inside Configure Function");
}

function createButton(selectedOptions, enteredUrl) {
    // console.log("Inside CreateButton");
    const body = document.getElementById("mainBody");
    const newButton = document.createElement('button');
    // newButton.textContent = `Button (${selectedOptions}, ${enteredUrl})`;
    newButton.textContent = "Click to POST data";
    body.appendChild(newButton);
    newButton.addEventListener('click', () => {
        // ----------- For fetching selected mark -------------
        const savedSheetName = tableau.extensions.dashboardContent.dashboard.worksheets;
        // console.log("savedSheetName ----> ",savedSheetName);
        const worksheetNames = savedSheetName.map(worksheet => worksheet.name);
        // console.log("saved worksheets name", worksheetNames);
        const slectedmarks = getselectedMark(worksheetNames);
        console.log("-- selectedMarks --", slectedmarks);
        // ------------ selected mark ends here --------------
        fetchFilters().then(() => {
            setTimeout(() => {
                sendPostRequest(selectedOptions, enteredUrl, slectedmarks);
            }, 3000); // 3000 milliseconds = 3 seconds
        }).catch(error => {
            console.error("Error:", error);
        });
    });
}

function sendPostRequest(selectedOptions, enteredUrl, selectedMarks) {
    console.log("SelectedMarks: ", selectedMarks);
    console.log("Available Filters: ", fieldMap);
    var selectedFilterMap = new Map();
    // Iterate through selectedOptions and check if each key exists in fieldMap
    selectedOptions.forEach(function (option) {
        if (fieldMap.has(option)) {
            selectedFilterMap.set(option, fieldMap.get(option));
        }
    });
    console.log("Selected filters and its Value: ", selectedFilterMap);
    var dataObject = {};
    selectedFilterMap.forEach((value, key) => {
        dataObject[key] = value.split(", "); // Convert comma-separated string to an array
    });
    // fetchFiltersValue();
    console.log("url for Post Req: ", enteredUrl);
    console.log("Selected Filters: ", selectedOptions);
    const url = enteredUrl;// e.g. "https://your-backend-api-url"; 
    const data = {
        // filters: selectedOptions
        filters: selectedFilterMap
    };
    const payload = {
        FiltersWithValue: dataObject,
        SelectedMarks: selectedMarks
    };
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })
        .then(response => response.json())
        .then(result => {
            // Handle the response from the API if needed
            console.log("API response:", result);
        })
        .catch(error => {
            // Handle error
            console.error("Error:", error);
        });
}







