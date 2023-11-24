// mosaicData.js

import { hexToUtf8, increment, decrement, prepareTransaction, fetchAccountData, calculateTotal, fetchCurrentXymRate } from './utils.js';

let restaurantPublicKey;
let restaurantAddress;
let currentXymRate;

export async function fetchMosaicData(address, venue_name = null, directAccess = false) {
    try {
        // Fetch account data using utility function
        const accountData = await fetchAccountData(address);
        
        // Extract mosaics
        const mosaics = accountData.mosaics;
        restaurantPublicKey = accountData.publicKey;
        restaurantAddress = address;
        console.log("Assigned restaurantPublicKey:", restaurantPublicKey);

        // Determine where to display the content: current document or new window
        let targetDocument = directAccess ? document : window.open("", "_blank").document;

        if (directAccess) {
            const contentDiv = targetDocument.getElementById("content");
            contentDiv.innerHTML = ''; // Clear existing content
        } else {
            targetDocument.write('<link rel="stylesheet" href="styles.css">');
        }

        const displayVenueName = venue_name || address;
        let menuContent = `
            <div class="box">
                <h1>Menu - ${displayVenueName}</h1>
                <div class="sub-box">
                    <div class="data-element"><b>Item</b></div>
                    <div class="data-element"><b>Description</b></div>
                    <div class="data-element"><b>Stock</b></div>
                    <div class="data-element"><b>Price</b></div>
                    <div class="data-element"><b>Basket</b></div>
                </div>
        `;

        // Fetch additional data for each mosaic and build the content
        for (let mosaic of mosaics) {
            const mosaicId = mosaic.id;
            const stock = mosaic.amount;
            try {
                const mosaicResponse = await fetch(`http://mikun-testnet.tk:3000/metadata?targetId=${mosaicId}`);
                const mosaicJson = await mosaicResponse.json();
                
                // Check if the mosaic ID is 72C0212E67A08BCE (tesnet XYM)
				if (mosaicId === "72C0212E67A08BCE") {
    				console.log('Skipping mosaic ID:', mosaicId);
    				continue;
				}
				
                if (!mosaicJson.data[0]) {
                    console.error('Mosaic data not found for mosaicId:', mosaicId);
                    continue;
                }
                
                // Check if sourceAddress is the same as targetAddress
                // Prevents displaying mosaics that are not created by the restaurant (spam)
				if (mosaicJson.data[0].metadataEntry.sourceAddress !== mosaicJson.data[0].metadataEntry.targetAddress) {
    				console.error('Source and target addresses do not match for mosaicId:', mosaicId);
    				continue; // Skip to the next iteration if they don't match
				}

                const description = hexToUtf8(mosaicJson.data[0].metadataEntry.value);
                const [itemName, itemDescription, price] = description.split(';');
                
                // Append each item to the menu content
                menuContent += `
                    <div class="sub-box" data-mosaic-id="${mosaicId}">
                        <div class="data-element">${itemName}</div>
                        <div class="data-element">${itemDescription}</div>
                        <div class="data-element">${stock}</div>
                        <div class="data-element">${price}</div>
                        <div class="data-element basket">
						<button class="decrement-button" data-mosaic-id="${mosaicId}">-</button>
                            <span id="selected-units-${mosaicId}">0</span>
                            <button class="increment-button" data-mosaic-id="${mosaicId}" data-stock="${stock}">+</button>
                        </div>
                    </div>
                `;

            } catch (error) {
                console.error('Error fetching additional data for mosaic:', error);
            }
        }

        currentXymRate = await fetchCurrentXymRate() || 0.02; // Fallback to a default rate if fetch fails

        menuContent += `
            <div class="box">
                <button class="calculate-btn calculate-total-button">Calculate Total Price</button>
                <div class="total-price-display" id="total-price">Total Price: $0</div>
                <div class="total-price-display" id="xym-price">Price (XYM): 0</div>
                <div class="conversion-rate">1 XYM = $${currentXymRate.toFixed(4)}</div>
                <div class="total-price-display">
                    Table Number: <input type="text" id="table-number" class="public-key" />
                    <button class="submit-order-btn">Submit</button>
                </div>
            </div>
        `;

        // If directAccess is true, append the content to the content div
        if (directAccess) {
            const contentDiv = targetDocument.getElementById("content");
            contentDiv.innerHTML = menuContent;
        } else {
            targetDocument.write(menuContent);
            targetDocument.write(`</div>`);
        }
        
        // Attach event listeners
        
		const submitBtn = targetDocument.querySelector('.submit-order-btn');
		if (submitBtn) {
    		submitBtn.addEventListener('click', submitOrder);
		}

		targetDocument.querySelectorAll('.increment-button').forEach(button => {
    		button.addEventListener('click', function() {
        		const mosaicId = this.getAttribute('data-mosaic-id');
        		const stock = this.getAttribute('data-stock');
        		increment(mosaicId, stock);
    		});
		});

		targetDocument.querySelectorAll('.decrement-button').forEach(button => {
    		button.addEventListener('click', function() {
        		const mosaicId = this.getAttribute('data-mosaic-id');
        		decrement(mosaicId);
    		});
		});
		
		targetDocument.querySelector('.calculate-total-button').addEventListener('click', calculateTotal);


    } catch (error) {
        console.error('Error fetching mosaic data:', error);
    }
}

function submitOrder() {
	
    const items = document.querySelectorAll('.sub-box');
    let orderedItems = [];
    let mosaicStructure = [];
    let totalUsdPrice = 0;
    let totalXymPrice = 0;
	let mosaicIds = [];
	
    items.forEach((item, index) => {
        if (index === 0) return;  // Skip the header row

        const itemNameElem = item.querySelector('.data-element:nth-child(1)');
		const mosaicId = item.getAttribute('data-mosaic-id');
		const unitsElem = document.getElementById('selected-units-' + mosaicId);
        const priceElem = item.querySelector('.data-element:nth-child(4)');
		mosaicIds.push(mosaicId);
        const unitsOrdered = parseInt(unitsElem.textContent);
        if (unitsOrdered > 0) {
            totalUsdPrice += unitsOrdered * parseFloat(priceElem.textContent.replace('$', ''));
            orderedItems.push(`${itemNameElem.textContent} x ${unitsOrdered}`);
            mosaicStructure.push(`[${mosaicId}, ${unitsOrdered}]`);
        }
    });

    totalXymPrice = totalUsdPrice / currentXymRate;
    // Check for ordered items first
    if (totalUsdPrice <= 0) {
        alert('Please select items before submitting.');
        return;
    }

    const tableNumber = document.getElementById('table-number').value;
    

    // Then check for values of public key and table number
    if (!tableNumber.trim()) {
        alert('Please ensure the table number are provided before submitting.');
        return;
    }
    
    // Prepare the order data
    const orderData = {
        items: orderedItems,
        mosaics: mosaicStructure,
        mosaicIds: mosaicIds,
        restaurantPublicKey: restaurantPublicKey,
        restaurantAddress: restaurantAddress,
        tableNumber: tableNumber,
        totalUsdPrice: totalUsdPrice,
        totalXymPrice: totalXymPrice
    };
    
    // Prepare the transaction
    const preparedTransaction = prepareTransaction(orderData);

    // Open a new window and display the captured information
    let newWindow = window.open("", "_blank");
    newWindow.document.write('<link rel="stylesheet" href="styles.css">');
    newWindow.document.write(`<div class="box">`);
	newWindow.increment = increment;
	newWindow.decrement = decrement;
	newWindow.calculateTotal = calculateTotal;
	newWindow.prepareTransaction = prepareTransaction;

    newWindow.document.write(`<h2>Order Details</h2>`);
    newWindow.document.write(`Table Number: ${tableNumber}<br><br>`);
    
    orderedItems.forEach(item => {
        newWindow.document.write(`${item}<br>`);
    });
    
    newWindow.document.write(`<br>Total Price (USD): $${totalUsdPrice.toFixed(2)}<br>`);
    newWindow.document.write(`Total Price (XYM): ${totalXymPrice.toFixed(2)}<br><br>`);
    

    newWindow.document.write(`<h2>Payment link:</h2><br>`);
    newWindow.document.write(`<a href="${preparedTransaction}">Send Payment</a><br>`);

    newWindow.document.write(`</div>`);
}