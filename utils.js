import symbolSdk from './node_modules/symbol-sdk/dist/bundle.web.js';

// Convert hex to UTF-8
export function hexToUtf8(hexValue) {
    let str = '';
    let bytes = [];

    for (let i = 0; i < hexValue.length; i += 2) {
        bytes.push(parseInt(hexValue.substr(i, 2), 16));
    }

    try {
        // Using TextDecoder to handle the conversion to UTF-8
        const decoder = new TextDecoder('utf-8');
        str = decoder.decode(new Uint8Array(bytes));
    } catch (e) {
        console.error("Failed to decode:", e);
    }

    return str;
}

export function increment(index, availableStock, docContext = document) {
    let unitsElem = docContext.getElementById('selected-units-' + index);

    if (!unitsElem) {
        console.error(`Looking for element with ID: selected-units-${index}`);
        return;
    }

    if (parseInt(unitsElem.textContent) < availableStock) {
        unitsElem.textContent = parseInt(unitsElem.textContent) + 1;
    } else {
        alert("Cannot exceed available stock!");
    }
}

export function decrement(index, docContext = document) {
    let unitsElem = docContext.getElementById('selected-units-' + index);

    if (!unitsElem) {
        console.error(`Looking for element with ID: selected-units-${index}`);
        return;
    }

    if (parseInt(unitsElem.textContent) > 0) {
        unitsElem.textContent = parseInt(unitsElem.textContent) - 1;
    }
}

export async function calculateTotal() {
    const items = document.querySelectorAll('.sub-box');
    let totalUsdPrice = 0;

    items.forEach((item, index) => {
        if (index === 0) return;  // Skip the header row

        const priceElem = item.querySelector('.data-element:nth-child(4)');
        const mosaicId = item.getAttribute('data-mosaic-id');
        const unitsElem = document.getElementById('selected-units-' + mosaicId);

        if (!unitsElem) {
            console.error(`Units element not found for mosaicId ${mosaicId}`);
            return;
        }

        const unitsOrdered = parseInt(unitsElem.textContent);
        totalUsdPrice += unitsOrdered * parseFloat(priceElem.textContent.replace('$', ''));
    });

    const totalPriceDisplay = document.getElementById('total-price');
    const xymPriceDisplay = document.getElementById('xym-price');

    const currentXymRate = await fetchCurrentXymRate();
    if (currentXymRate) {
        const xymPrice = totalUsdPrice / currentXymRate;
        totalPriceDisplay.textContent = `Total Price: $${totalUsdPrice.toFixed(2)}`;
        xymPriceDisplay.textContent = `Price (XYM): ${xymPrice.toFixed(2)}`;
    } else {
        // Handle the scenario where the rate could not be fetched
        console.error('Could not fetch the current XYM rate');
    }
}

export async function updateConversionRateDisplay() {
    const currentXymRate = await fetchCurrentXymRate();
    if (currentXymRate) {
        const conversionRateElement = document.querySelector('.conversion-rate');
        if (conversionRateElement) {
            conversionRateElement.textContent = `1 XYM = $${currentXymRate.toFixed(2)}`;
        }
    } else {
        console.error('Could not fetch the current XYM rate');
    }
}

export function prepareTransaction(orderData) {
    console.log('symbolSdk:', symbolSdk);
    const facade = new symbolSdk.facade.SymbolFacade('testnet');
    console.log('facade:', facade);
    const generationHash = '49D6E1CE276A85B70EAFE52349AACCA389302E7A9754BCF1221E79494FC665A4' // For testnet

    // Extract order details
    const { items, mosaics, restaurantPublicKey, restaurantAddress, tableNumber, totalUsdPrice, totalXymPrice } = orderData;

    // Create transfer transaction
    const orderDetails = `${tableNumber};${items.join(', ')};${totalUsdPrice};${totalXymPrice}`;
    const encoder = new TextEncoder(); // TextEncoder is used to encode strings to Uint8Array
    const encodedOrderDetails = encoder.encode(orderDetails);
    const message = new Uint8Array([0, ...encodedOrderDetails]);

    const transfer = facade.transactionFactory.createEmbedded({
        'type': 'transfer_transaction_v1',
        'signerPublicKey': '0000000000000000000000000000000000000000000000000000000000000000', // Placeholder
        'recipientAddress': restaurantAddress,
        'message': message,
        'mosaics': [{ 'mosaicId': BigInt("0x72C0212E67A08BCE"), 'amount': BigInt(Math.round(totalXymPrice * 1000000))}]
    });

    // Calculate deadline
    const netStart = 1667250467;
    const deadline = BigInt(new Date().getTime() + 2 * 60 * 60 * 1000 - netStart * 1000);

// Create mosaicSupply transactions for each ordered item
    const embeddedTxs = [transfer];
    for (const mosaicItem of mosaics) {
        const parts = mosaicItem.replace(/[\[\]"]/g, '').split(','); // Removes brackets and quotes, then splits by comma
        const mosaicId = parts[0].trim();
        const units = parseInt(parts[1].trim());

        const mosaicSupply = facade.transactionFactory.createEmbedded({
            'type': 'mosaic_supply_change_transaction_v1',
            'signerPublicKey': restaurantPublicKey,
            'delta':BigInt(units),  // Convert units to BigInt
            'action': 0x0, // Reduce supply
            'mosaicId': BigInt('0x' + mosaicId)
        });
        embeddedTxs.push(mosaicSupply);
        console.log('Added Mosaic Supply:', mosaicSupply);
    }
    console.log('All Embedded Transactions:', embeddedTxs);


    // Calculate the merkle hash
    const merkleHash = facade.constructor.hashEmbeddedTransactions(embeddedTxs);

    // Create aggregate transaction
    const aggregateTransaction = facade.transactionFactory.create({
        'type': 'aggregate_bonded_transaction_v2',
        'signerPublicKey': '0000000000000000000000000000000000000000000000000000000000000000',  // Placeholder
        'deadline': deadline,
        'transactionsHash': merkleHash,
        'transactions': embeddedTxs
    });

    // Set fee
    aggregateTransaction.fee.value = BigInt(aggregateTransaction.size * 150);
    const payload = symbolSdk.utils.uint8ToHex(aggregateTransaction.serialize());
    const uri = `web+symbol://transaction?data=${payload}&generationHash=${generationHash}`;
    console.log(payload)
    console.log(uri)
    return uri;
}

// Function to generate random number for the mosaic nonce
export function generateRandomId() {
    return Math.floor(Math.random() * 4294967296).toString();
}

// Function to fetch account data from the API
export async function fetchAccountData(address) {
    const response = await fetch(`http://mikun-testnet.tk:3000/accounts/${address}`);
    const json = await response.json();
    console.log(json);
    return json.account;
}

export async function fetchMosaicMetadata(mosaicId) {
    try {
        const mosaicResponse = await fetch(`http://mikun-testnet.tk:3000/metadata?targetId=${mosaicId}`);
        const mosaicJson = await mosaicResponse.json();

        if (!mosaicJson.data[0]) {
            console.error('Mosaic data not found for mosaicId:', mosaicId);
            return { mosaicId, metadata: null };
        }

        const metadataEntry = mosaicJson.data[0].metadataEntry;
        const description = hexToUtf8(metadataEntry.value);
        const [itemName, itemDescription, price] = description.split(';');
        return {
            mosaicId: mosaicId,
            metadata: {
                itemName: itemName,
                itemDescription: itemDescription,
                price: price,
                scopedMetadataKey: metadataEntry.scopedMetadataKey
            }
        };

    } catch (error) {
        console.error('Error fetching additional data for mosaic:', error);
        return { mosaicId, metadata: null };
    }
}


export function registerVenue(symbolAddress, publicKey, registrationData) {

    try {
        console.log("in registerVenue")
        const facade = new symbolSdk.facade.SymbolFacade('testnet');
        const generationHash = '49D6E1CE276A85B70EAFE52349AACCA389302E7A9754BCF1221E79494FC665A4' // For testnet
        const adminAccount = 'TDOXHWCILFG7XRZ5CASLOLC4RKOMRF7D2EQOTXQ' // Admin account address
        const adminPubKey = '8054DC8958324903F4355E4604D8C00612A52451FEAFC31E2C23C65F31399A58' // Admin account public key
        const metadataKey = BigInt(generateRandomId());
        const encoder = new TextEncoder();
        const encoded = encoder.encode(registrationData);
        const data = new Uint8Array([0, ...encoded]);
        const len = data.length;

        const metadata = facade.transactionFactory.createEmbedded({
            'type': 'account_metadata_transaction_v1',
            'signerPublicKey': publicKey,
            'targetAddress': adminAccount,
            'scopedMetadataKey': metadataKey,
            'value': data,
            'valueSizeDelta': len
        });

        const embeddedTxs = [metadata];

        // Calculate deadline
        const netStart = 1667250467;
        const deadline = BigInt(new Date().getTime() + 2 * 60 * 60 * 1000 - netStart * 1000);

        // Calculate the merkle hash
        const merkleHash = facade.constructor.hashEmbeddedTransactions(embeddedTxs);

        // Create aggregate transaction
        const aggregateTransaction = facade.transactionFactory.create({
            'type': 'aggregate_bonded_transaction_v2',
            'signerPublicKey': publicKey,
            'deadline': deadline,
            'transactionsHash': merkleHash,
            'transactions': embeddedTxs
        });

        aggregateTransaction.fee.value = BigInt(aggregateTransaction.size * 150);

        const payload = symbolSdk.utils.uint8ToHex(aggregateTransaction.serialize());
        const uri = `web+symbol://transaction?data=${payload}&generationHash=${generationHash}`;
        console.log(payload);
        console.log(uri);
        return uri;
    } catch (error) {
        // Log the error message and stack
        console.log('Error message:', error.message);
        console.log('Error stack:', error.stack);
        // Handle the error appropriately
        return null;
    }
}

export function processInventoryDifferences(newItems, inventoryChanges, inventorySupplyChange, removals, publicKey, mosaicMetadataMapping, address) {
    const differences = {
        newItems,
        modifiedItems: {},
        supplyOnlyChanges: {},
        removedItems: removals
    };

    let embeddedTxs = [];
    const facade = new symbolSdk.facade.SymbolFacade('testnet');
    const generationHash = '49D6E1CE276A85B70EAFE52349AACCA389302E7A9754BCF1221E79494FC665A4'; // For testnet
    const burnAddress = 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI'; // Burn address
    // Calculate deadline
    const netStart = 1667250467;
    const deadline = BigInt(new Date().getTime() + 2 * 60 * 60 * 1000 - netStart * 1000);
    console.log('Inventory changes:', inventoryChanges);
    console.log('New items:', newItems);


    inventoryChanges.forEach(change => {
        console.log('Processing change:', change);
        // Determine the types of changes
        let supplyChanged = parseInt(change.original.stock, 10) !== parseInt(change.new.stock, 10);
        let metadataChanged = change.original.itemName !== change.new.itemName ||
            change.original.itemDescription !== change.new.itemDescription ||
            change.original.price !== change.new.price;

        if (metadataChanged) {
            console.log('Metadata changed for:', change.id);
            // Handle metadata change
            try{
                const scopedMetadataKey = mosaicMetadataMapping[change.id].metadata.scopedMetadataKey;
                console.log('Type of scopedMetadataKey:', typeof scopedMetadataKey);
                console.log('Value of scopedMetadataKey:', scopedMetadataKey);
                const metadataValue = change.new.itemName + ";" + change.new.itemDescription + ";" + change.new.price;
                const originalValue = change.original.itemName + ";" + change.original.itemDescription + ";" + change.original.price;
                const newValueSize = new Blob([metadataValue]).size;
                const originalValueSize = new Blob([originalValue]).size;
                const valueSizeDelta = newValueSize - originalValueSize;


                console.log('Metadata value:', metadataValue);
                console.log('Metadata key:', scopedMetadataKey);
                console.log('signerPublicKey', publicKey);
                console.log('targetAddress', address);
                const bigint = BigInt("0x" + change.id);
                console.log('target_mosaic_id', bigint.toString(16));
                console.log('valueSizeDelta', valueSizeDelta);

                const metadataTransaction = facade.transactionFactory.createEmbedded({
                    'type': 'mosaic_metadata_transaction_v1',
                    'signerPublicKey': publicKey,
                    'targetAddress': address,
                    'targetMosaicId': bigint,
                    'scopedMetadataKey': BigInt('0x' + scopedMetadataKey),
                    'value': metadataValue,
                    'valueSizeDelta': valueSizeDelta
                });

                embeddedTxs.push(metadataTransaction);
                console.log('Created metadataTransaction:', metadataTransaction);

            } catch (error) {
                console.log("Error creating metadata transaction for change id " + change.id + ": ", error);
                // Handle error or rethrow as needed
            }
        }
    });

    // Now handle the supply changes separately
    inventorySupplyChange.forEach(change => {
        let supplyChanged = change.original.stock !== change.new.stock;
        if (supplyChanged) {
            console.log('Supply changed for:', change.id);
            // Handle supply change
            let delta = change.new.stock - change.original.stock;
            let action = null;

            if (delta < 0) {
                action = 0x0; // Reduce supply
                delta = Math.abs(delta);
            }
            else{
                action = 0x1; // Increase supply
            }

            try {
                const mosaicSupply = facade.transactionFactory.createEmbedded({
                    'type': 'mosaic_supply_change_transaction_v1',
                    'signerPublicKey': publicKey,
                    'delta': BigInt(delta),
                    'action': action,
                    'mosaicId': BigInt('0x' + change.id)
                });
                embeddedTxs.push(mosaicSupply);
                console.log('Created mosaicSupply:', mosaicSupply);
            }catch (error) {
                console.log("Error creating mosaic supply transaction for mosaic id " + change.id + ": ", error);
            }


        }
    });

    // Process new items
    newItems.forEach(item => {

        console.log('Item:', item);
        console.log(symbolSdk);

        const metadataKey = BigInt(generateRandomId());
        const nonce = generateRandomId();
        const supply = item.new.stock;
        console.log('Metadata key:', metadataKey);
        console.log('Nonce:', nonce);

        const metadata = item.new.itemName + ";" + item.new.itemDescription + ";" + item.new.price;
        console.log('Metadata:', metadata);
        const encoder = new TextEncoder();
        const encoded = encoder.encode(metadata);
        const data = new Uint8Array([0, ...encoded]);
        const len = data.length;
        console.log('data:', data);
        console.log('Address:', address);

        const addressObject = new symbolSdk.symbol.Address(address);
        console.log('Address:', addressObject);
        const mosaicId = symbolSdk.symbol.generateMosaicId(addressObject, nonce);
        console.log('Generated Mosaic ID:', mosaicId);

        // Add mosaic definition
        const mosaicDefinition = facade.transactionFactory.createEmbedded({
            'type': 'mosaic_definition_transaction_v1',
            'signerPublicKey': publicKey,
            'duration': BigInt(0),
            'flags': 'supply_mutable',
            'nonce': Number(nonce),
            'divisibility': Number(0)
        })
        embeddedTxs.push(mosaicDefinition);

        // Add mosaic supply change
        const mosaicSupply = facade.transactionFactory.createEmbedded({
            'type': 'mosaic_supply_change_transaction_v1',
            'signerPublicKey': publicKey,
            'delta': BigInt(supply),
            'action': 0x01,
            'mosaicId': mosaicId
        });
        embeddedTxs.push(mosaicSupply);

        // Add mosaic metadata
        const metadataTx = facade.transactionFactory.createEmbedded({
            'type': 'mosaic_metadata_transaction_v1',
            'signerPublicKey': publicKey,
            'targetAddress': address,
            'scopedMetadataKey': metadataKey,
            'targetMosaicId': BigInt(mosaicId),
            'value': data,
            'valueSizeDelta': len
        });
        embeddedTxs.push(metadataTx);
    });


// Process removals
    removals.forEach(item => {
        try {
            console.log(item);
            // Create a transfer transaction for the remaining stock to burn address
            const transfer = facade.transactionFactory.createEmbedded({
                'type': 'transfer_transaction_v1',
                'signerPublicKey': publicKey,
                'recipientAddress': burnAddress,
                'mosaics': [
                    {'mosaicId': BigInt('0x' + item.id), 'amount': BigInt(item.original.stock)}
                ]
            });
            embeddedTxs.push(transfer);
        } catch (error) {
            console.log(`Error creating transfer transaction for item ${item}:`, error);
        }
    });


    console.log('Embedded transactions:', embeddedTxs);

    // Create aggregate transaction
    const merkleHash = facade.constructor.hashEmbeddedTransactions(embeddedTxs);
    console.log('Merkle hash:', merkleHash);

    const aggregateTransaction = facade.transactionFactory.create({
        'type': 'aggregate_complete_transaction_v2',
        'signerPublicKey': publicKey,
        'deadline': deadline,
        'transactionsHash': merkleHash,
        'transactions': embeddedTxs
    });
    console.log('Aggregate transaction:', aggregateTransaction);

    // Setting the fee value for the transaction
    aggregateTransaction.fee.value = BigInt(aggregateTransaction.size * 150);

    console.log(symbolSdk);
    const payload = symbolSdk.utils.uint8ToHex(aggregateTransaction.serialize());
    console.log(payload);
    const uri = `web+symbol://transaction?data=${payload}&generationHash=${generationHash}`;
    return uri;
}

export async function fetchCurrentXymRate() {
    try {
        const response = await fetch('https://min-api.cryptocompare.com/data/price?fsym=XYM&tsyms=USD');
        const data = await response.json();
        return data.USD;
    } catch (error) {
        console.error('Failed to fetch XYM rate:', error);
        return null;
    }
}
