// FreeAuctionSite - Auction Display Tool

// State
let auctionItems = [];
let eventSettings = {
    name: '',
    subtitle: ''
};

// DOM Elements
const itemsList = document.getElementById('itemsList');
const itemCount = document.getElementById('itemCount');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadFromStorage();
    renderItems();
});

// Add Item
async function addItem() {
    const nameInput = document.getElementById('itemName');
    const descInput = document.getElementById('itemDescription');
    const startingInput = document.getElementById('startingBid');
    const currentInput = document.getElementById('currentBid');

    const name = nameInput.value.trim();
    const description = descInput.value.trim();
    const startingBid = parseFloat(startingInput.value) || 0;
    const currentBid = parseFloat(currentInput.value) || startingBid;

    if (!name) {
        alert('Please enter an item name');
        nameInput.focus();
        return;
    }

    // Enforce 10-item limit for free users
    const FREE_ITEM_LIMIT = 10;
    if (auctionItems.length >= FREE_ITEM_LIMIT) {
        const isPremium = typeof SupabaseClient !== 'undefined' && await SupabaseClient.isPremium();
        if (!isPremium) {
            if (typeof featureGate !== 'undefined') {
                featureGate.showLimitReached('items', auctionItems.length, FREE_ITEM_LIMIT);
            } else {
                alert(`Free plan is limited to ${FREE_ITEM_LIMIT} items. Upgrade to Pro for unlimited items.`);
            }
            return;
        }
    }

    const item = {
        id: Date.now(),
        name,
        description,
        startingBid,
        currentBid,
        createdAt: new Date().toISOString()
    };

    auctionItems.push(item);
    saveToStorage();
    renderItems();

    // Clear form
    nameInput.value = '';
    descInput.value = '';
    startingInput.value = '';
    currentInput.value = '';
    nameInput.focus();
}

// Render Items
function renderItems() {
    itemCount.textContent = `(${auctionItems.length})`;

    if (auctionItems.length === 0) {
        itemsList.innerHTML = `
            <div class="empty-state">
                <p>No items added yet. Add your first auction item to get started.</p>
            </div>
        `;
        return;
    }

    // Sort by current bid (highest first)
    const sortedItems = [...auctionItems].sort((a, b) => b.currentBid - a.currentBid);

    itemsList.innerHTML = sortedItems.map((item, index) => `
        <div class="auction-item" data-id="${item.id}">
            <div style="font-size: 1.25rem; font-weight: 700; color: var(--primary); min-width: 40px;">
                #${index + 1}
            </div>
            <div class="auction-item-info">
                <h4>${escapeHtml(item.name)}</h4>
                <p>${escapeHtml(item.description) || 'No description'}</p>
            </div>
            <div class="auction-item-bids">
                <div class="current">$${item.currentBid.toLocaleString()}</div>
                <div class="starting">Starting: $${item.startingBid.toLocaleString()}</div>
            </div>
            <div class="auction-item-actions">
                <button onclick="editBid(${item.id})" title="Update Bid">✏️</button>
                <button onclick="deleteItem(${item.id})" class="delete" title="Delete">🗑️</button>
            </div>
        </div>
    `).join('');
}

// Edit Bid
function editBid(id) {
    const item = auctionItems.find(i => i.id === id);
    if (!item) return;

    const newBid = prompt(`Enter new bid for "${item.name}":`, item.currentBid);
    if (newBid === null) return;

    const bid = parseFloat(newBid);
    if (isNaN(bid) || bid < 0) {
        alert('Please enter a valid bid amount');
        return;
    }

    item.currentBid = bid;
    saveToStorage();
    renderItems();
}

// Delete Item
function deleteItem(id) {
    const item = auctionItems.find(i => i.id === id);
    if (!item) return;

    if (!confirm(`Delete "${item.name}"?`)) return;

    auctionItems = auctionItems.filter(i => i.id !== id);
    saveToStorage();
    renderItems();
}

// Preview Display
function previewDisplay() {
    if (auctionItems.length === 0) {
        alert('Add at least one item before previewing');
        return;
    }

    const displayData = getDisplayData();
    const displayWindow = window.open('', '_blank');
    displayWindow.document.write(generateDisplayHTML(displayData));
    displayWindow.document.close();
}

// Launch Display
async function launchDisplay() {
    if (auctionItems.length === 0) {
        alert('Add at least one item before launching');
        return;
    }

    try {
        // Generate unique ID for this display
        const displayId = generateDisplayId();
        const displayData = getDisplayData();

        // Initialize storage adapter
        await storage.initialize();

        // Check if premium and apply branding
        const isPremium = await SupabaseClient.isPremium();
        if (isPremium) {
            // Check if user wants to remove watermark
            const hasWatermarkAccess = await SupabaseClient.hasFeatureAccess('hide_watermark');
            if (hasWatermarkAccess) {
                displayData.event.hideWatermark = true;
            }
        }

        // Save event using storage adapter
        await storage.saveEvent(displayId, displayData);

        // Remember this display ID so future edits keep the display in sync
        localStorage.setItem('bidscreen_active_display_id', displayId);

        // Create display URL
        const displayUrl = `${window.location.origin}/display.html?id=${displayId}`;
        const controlUrl = `${window.location.origin}/control.html?id=${displayId}`;

        // Show modal with links
        const modal = document.createElement('div');
        modal.innerHTML = `
            <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;">
                <div style="background: white; border-radius: 16px; padding: 40px; max-width: 500px; width: 100%;">
                    <h2 style="margin-bottom: 8px;">🎉 Display Created!</h2>
                    <p style="color: #64748b; margin-bottom: 32px;">
                        ${isPremium
                            ? '✨ Your premium display has been created with real-time sync!'
                            : 'Share these links to control and display your auction.'}
                    </p>

                    <div style="margin-bottom: 24px;">
                        <label style="display: block; font-weight: 600; margin-bottom: 8px;">📺 Display Link (for TV/projector)</label>
                        <div style="display: flex; gap: 8px;">
                            <input type="text" value="${displayUrl}" readonly style="flex: 1; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px;">
                            <button onclick="copyToClipboard('${displayUrl}')" style="padding: 12px 16px; background: #6366f1; color: white; border: none; border-radius: 8px; cursor: pointer;">Copy</button>
                        </div>
                    </div>

                    <div style="margin-bottom: 32px;">
                        <label style="display: block; font-weight: 600; margin-bottom: 8px;">📱 Control Link (for your phone)</label>
                        <div style="display: flex; gap: 8px;">
                            <input type="text" value="${controlUrl}" readonly style="flex: 1; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px;">
                            <button onclick="copyToClipboard('${controlUrl}')" style="padding: 12px 16px; background: #6366f1; color: white; border: none; border-radius: 8px; cursor: pointer;">Copy</button>
                        </div>
                        ${!isPremium ? '<p style="color: #f59e0b; font-size: 0.875rem; margin-top: 8px;">⚠️ Free plan: Control panel must be on the same device as display</p>' : ''}
                    </div>

                    <div style="display: flex; gap: 12px;">
                        <button onclick="window.open('${displayUrl}', '_blank')" style="flex: 1; padding: 16px; background: #10b981; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">Open Display</button>
                        <button onclick="this.closest('div').parentElement.parentElement.remove()" style="flex: 1; padding: 16px; background: #f1f5f9; color: #1e293b; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">Close</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (error) {
        console.error('Error launching display:', error);
        alert('Error creating display. Please try again.');
    }
}

// Get Display Data
function getDisplayData() {
    const eventName = document.getElementById('eventName').value || 'Auction';
    const eventSubtitle = document.getElementById('eventSubtitle').value || '';

    return {
        event: {
            name: eventName,
            subtitle: eventSubtitle
        },
        items: [...auctionItems].sort((a, b) => b.currentBid - a.currentBid),
        updatedAt: new Date().toISOString()
    };
}

// Generate Display HTML
function generateDisplayHTML(data) {
    const totalRaised = data.items.reduce((sum, item) => sum + item.currentBid, 0);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(data.event.name)} - Live Auction Display</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Inter', sans-serif;
            min-height: 100vh;
            background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
            padding: 40px;
            display: flex;
            flex-direction: column;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        .header h1 {
            color: white;
            font-size: 3rem;
            margin-bottom: 8px;
        }
        .header p {
            color: rgba(255,255,255,0.7);
            font-size: 1.5rem;
        }
        .items {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 16px;
            max-width: 1200px;
            margin: 0 auto;
            width: 100%;
        }
        .item {
            display: flex;
            align-items: center;
            background: rgba(255,255,255,0.1);
            border-radius: 16px;
            padding: 24px 32px;
            gap: 24px;
        }
        .rank {
            font-size: 2.5rem;
            font-weight: 800;
            color: #818cf8;
            min-width: 80px;
        }
        .info {
            flex: 1;
        }
        .info h3 {
            color: white;
            font-size: 1.75rem;
            margin-bottom: 4px;
        }
        .info p {
            color: rgba(255,255,255,0.7);
            font-size: 1.125rem;
        }
        .bid {
            text-align: right;
        }
        .bid-label {
            color: rgba(255,255,255,0.6);
            font-size: 0.875rem;
            text-transform: uppercase;
        }
        .bid-amount {
            font-size: 3rem;
            font-weight: 800;
            color: #10b981;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 24px;
            border-top: 1px solid rgba(255,255,255,0.2);
        }
        .total {
            font-size: 1.5rem;
            color: white;
        }
        .total strong {
            color: #10b981;
            font-size: 2.5rem;
        }
        .powered {
            margin-top: 16px;
            color: rgba(255,255,255,0.4);
            font-size: 0.875rem;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${escapeHtml(data.event.name)}</h1>
        ${data.event.subtitle ? `<p>${escapeHtml(data.event.subtitle)}</p>` : ''}
    </div>
    
    <div class="items">
        ${data.items.map((item, index) => `
            <div class="item">
                <div class="rank">#${index + 1}</div>
                <div class="info">
                    <h3>${escapeHtml(item.name)}</h3>
                    <p>${escapeHtml(item.description) || ''}</p>
                </div>
                <div class="bid">
                    <div class="bid-label">Current Bid</div>
                    <div class="bid-amount">$${item.currentBid.toLocaleString()}</div>
                </div>
            </div>
        `).join('')}
    </div>
    
    <div class="footer">
        <div class="total">Total Raised: <strong>$${totalRaised.toLocaleString()}</strong></div>
        ${!data.event?.hideWatermark ? '<div class="powered">Powered by FreeAuctionSite.io</div>' : ''}
    </div>
</body>
</html>
    `;
}

// Utility Functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function generateDisplayId() {
    return Math.random().toString(36).substr(2, 8);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Copied to clipboard!');
    }).catch(() => {
        prompt('Copy this link:', text);
    });
}

function saveToStorage() {
    localStorage.setItem('bidscreen_items', JSON.stringify(auctionItems));
    localStorage.setItem('bidscreen_event', JSON.stringify(eventSettings));

    // If there's an active display, sync it so the display screen updates instantly
    const activeDisplayId = localStorage.getItem('bidscreen_active_display_id');
    if (activeDisplayId) {
        const displayData = {
            event: {
                name: eventSettings.name || 'Auction',
                subtitle: eventSettings.subtitle || ''
            },
            items: [...auctionItems].sort((a, b) => b.currentBid - a.currentBid),
            updatedAt: new Date().toISOString()
        };
        localStorage.setItem(`bidscreen_display_${activeDisplayId}`, JSON.stringify(displayData));

        // Same-device: BroadcastChannel (instant, same browser)
        try {
            const bc = new BroadcastChannel(`bidscreen_${activeDisplayId}`);
            bc.postMessage({ type: 'update', data: displayData });
            bc.close();
        } catch (e) { /* BroadcastChannel not supported */ }

        // Cross-device: Supabase Realtime Broadcast (WebSocket, any device)
        try {
            const sb = typeof SupabaseClient !== 'undefined' && SupabaseClient.get();
            if (sb) {
                // Reuse persistent channel, create if first save
                if (!window._appSupabaseChannel || window._appSupabaseChannelId !== activeDisplayId) {
                    window._appSupabaseChannelId = activeDisplayId;
                    window._appSupabaseChannel = sb.channel(`display:${activeDisplayId}`).subscribe();
                }
                window._appSupabaseChannel.send({
                    type: 'broadcast',
                    event: 'bid_update',
                    payload: { data: displayData }
                }).catch(() => {});
            }
        } catch(e) { /* ignore */ }
    }
}

function loadFromStorage() {
    try {
        const items = localStorage.getItem('bidscreen_items');
        const event = localStorage.getItem('bidscreen_event');

        if (items) {
            auctionItems = JSON.parse(items);
        }
        if (event) {
            eventSettings = JSON.parse(event);
            document.getElementById('eventName').value = eventSettings.name || '';
            document.getElementById('eventSubtitle').value = eventSettings.subtitle || '';
        }

        // Auto-detect active display ID if not already stored
        // (covers users who launched a display before this feature was added)
        if (!localStorage.getItem('bidscreen_active_display_id')) {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('bidscreen_display_')) {
                    localStorage.setItem('bidscreen_active_display_id', key.replace('bidscreen_display_', ''));
                    break;
                }
            }
        }
    } catch (e) {
        console.error('Error loading from storage:', e);
    }
}

// Auto-save event settings
document.getElementById('eventName')?.addEventListener('change', function() {
    eventSettings.name = this.value;
    saveToStorage();
});

document.getElementById('eventSubtitle')?.addEventListener('change', function() {
    eventSettings.subtitle = this.value;
    saveToStorage();
});
