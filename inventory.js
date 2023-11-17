import {fetchAccountData, fetchMosaicMetadata, generateRandomId, processInventoryDifferences, displayQRCode} from './utils.js';
console.log('Inventory script loaded');

let address = null; // Global variable for address

// Object to keep track of the original state of the items
const originalState = {};

// Object to keep track of the new state of the items
const newState = {};

// Keep track of removed mosaics
const removedIds = new Set();

// Function to initialize the original state with the current inventory
function initializeState(mosaics) {
    console.log('Initializing state with mosaics:', mosaics); // Log the mosaics data for debugging
    mosaics.forEach(mosaic => {
        if (!mosaic.id) {
            console.error('Mosaic is missing an ID:', mosaic);
            return; // Skip this mosaic if it has no ID
        }
        originalState[mosaic.id] = { 
            itemName: mosaic.itemName || '',
            itemDescription: mosaic.itemDescription || '',
            stock: Number(mosaic.amount) || 0, 
            price: mosaic.price || ''
        };
    });
    console.log('Initialized original state:', originalState); // Log the initialized state for debugging
}

function createEditableRow(mosaic, index) {
    // Needed as we add an additional byte for display in the explorer but don't want
    // to output it here
	const itemName = mosaic.itemName && mosaic.itemName.startsWith('\x00') ? mosaic.itemName.slice(1) : mosaic.itemName || '';
    console.log(`Creating row for mosaicId: ${mosaic.id}`);

    return `
        <tr id="mosaic-${mosaic.id}">
            <td><input type="text" value="${itemName}" class="inventory-item" data-field="itemName" data-id="${mosaic.id}"/></td>
            <td><textarea class="inventory-item description" data-field="itemDescription" data-id="${mosaic.id}">${mosaic.itemDescription || ''}</textarea></td>
            <td><input type="number" value="${mosaic.amount || 0}" min="0" class="inventory-item" data-field="stock" data-id="${mosaic.id}"/></td>
            <td><input type="text" value="${mosaic.price || ''}" class="inventory-item" data-field="price" data-id="${mosaic.id}"/></td>
            <td><button class="remove-button calculate-btn" data-mosaic-id="${mosaic.id}">Remove</button></td>
        </tr>
    `;
}

// Function to add a new row to the table with empty values
function addNewRow() {
    const tableBody = document.getElementById('inventory-table-body');
    const newId = generateRandomId(); // Using random ID for the example
    const newRowHtml = createEditableRow({ id: newId }, tableBody.children.length);
    tableBody.insertAdjacentHTML('beforeend', newRowHtml);
    attachChangeEventListeners(newId);
    // Initialize the newState for the new item with some default values or empty strings
    newState[newId] = {
        itemName: '',
        itemDescription: '',
        stock: 0,
        price: ''
    };
}

// Function to attach change event listeners to input fields
function attachChangeEventListeners(mosaicId) {
    const inputs = document.querySelectorAll(`[data-id="${mosaicId}"]`);
    inputs.forEach(input => {
        input.addEventListener('change', (event) => {
            const field = event.target.getAttribute('data-field');
            if (!newState[mosaicId]) {
                newState[mosaicId] = { ...originalState[mosaicId] };
            }
            newState[mosaicId][field] = event.target.value;
            // Log the state after a change has been made
            console.log(`State after change for ${mosaicId}:`, newState[mosaicId]);
        });
    });
}

function removeRow(mosaicId) {
    // Check if the row exists
    const row = document.getElementById(`mosaic-${mosaicId}`);
    if (row) {
        // Track the removal of the item
        removedIds.add(mosaicId);
        // Remove the item from the newState object
        delete newState[mosaicId];
        // Remove the row from the table
        row.remove();
	    console.log(`State after removal for ${mosaicId}:`, { newState, originalState, removedIds });
    } else {
        console.error(`No row found with ID: mosaic-${mosaicId}`);
    }
}

function saveInventoryChanges(publicKey, mosaicMetadataMapping, address) {
    const inventoryChanges = [];
    const inventorySupplyChange = [];
    const newItems = [];
    const removals = [];

    for (const id in newState) {
        if (!originalState.hasOwnProperty(id)) {
            newItems.push({ id: id, new: newState[id] });
        } else {
            const original = originalState[id];
            const newValues = newState[id];
            let supplyChanged = original.stock !== newValues.stock;
            let otherChanged = original.itemName !== newValues.itemName ||
                original.itemDescription !== newValues.itemDescription ||
                original.price !== newValues.price;

            if (supplyChanged && !otherChanged) {
                inventorySupplyChange.push({ id: id, original: original, new: newValues });
            } else if (supplyChanged || otherChanged) {
                inventoryChanges.push({ id: id, original: original, new: newValues });
            }
        }
    }

    for (const id of removedIds) {
        if (originalState.hasOwnProperty(id)) {
            removals.push({ id: id, original: originalState[id], new: null });
        }
    }

    const changes = processInventoryDifferences(newItems, inventoryChanges, inventorySupplyChange, removals, publicKey, mosaicMetadataMapping, address);
    console.log(changes);
    displayQRCode(changes); // Call the function to display the QR code

    const newWindow = window.open('', '_blank');
    if (newWindow) {
        newWindow.document.write(`<p>URI: <a href="${changes}">${changes}</a></p>`);
        newWindow.document.close(); // Close the document stream
    } else {
        console.log('Failed to open a new window. It may have been blocked.');
    }
}

async function onReady() {
    console.log('DOM fully loaded and parsed');
    const urlParams = new URLSearchParams(window.location.search);
    console.log(window.location.search);
    let publicKey = null;
    let mosaicMetadataMapping = {};

    // Event delegation for remove button
    document.getElementById('inventory-table-body').addEventListener('click', function(event) {
        if (event.target && event.target.classList.contains('remove-button')) {
            const mosaicId = event.target.getAttribute('data-mosaic-id');
            if (mosaicId) {
                removeRow(mosaicId);
            } else {
                console.error('mosaicId is undefined for the clicked remove button');
            }
        }
    });

    const address = urlParams.get('address');
    console.log(address);

    if (address) {
        try {
            const accountData = await fetchAccountData(address);
            const mosaics = accountData.mosaics;
            publicKey = accountData.publicKey;

            const mosaicMetadataPromises = mosaics.map(mosaic =>
                fetchMosaicMetadata(mosaic.id)
            );
            const mosaicMetadataResults = await Promise.all(mosaicMetadataPromises);

            // Store metadata mapping
            mosaicMetadataMapping = mosaicMetadataResults.reduce((acc, metadata) => {
                if (metadata && metadata.mosaicId) {
                    acc[metadata.mosaicId] = metadata;
                }
                return acc;
            }, {});

            const enrichedMosaics = mosaics.map((mosaic, index) => {
                const detail = mosaicMetadataMapping[mosaic.id];
                return {
                    ...mosaic,
                    itemName: detail && detail.metadata ? detail.metadata.itemName : '',
                    itemDescription: detail && detail.metadata ? detail.metadata.itemDescription : '',
                    price: detail && detail.metadata ? detail.metadata.price : ''
                };
            });

            initializeState(enrichedMosaics);

            const mosaicsWithCompleteMetadata = enrichedMosaics.filter(mosaic => mosaic.itemName && mosaic.itemDescription && mosaic.price);
            const tableBody = document.getElementById('inventory-table-body');
            mosaicsWithCompleteMetadata.forEach((mosaic, index) => {
                const rowHtml = createEditableRow(mosaic, index);
                tableBody.insertAdjacentHTML('beforeend', rowHtml);
                attachChangeEventListeners(mosaic.id);
            });

        } catch (error) {
            console.error('Error loading inventory:', error);
        }
    }

    document.getElementById('add-new-row').addEventListener('click', addNewRow);
    document.getElementById('save-inventory').addEventListener('click', () => saveInventoryChanges(publicKey, mosaicMetadataMapping, address));
}


if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
} else {
    // The DOMContentLoaded event already fired
    onReady();
}

