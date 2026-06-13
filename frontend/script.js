let game = null;
let dragStart = null;
let isDragging = false;
let currentPreview = null;
let currentGridSize = 2;
let playerProgress = 2; // Track highest grid achieved by player without AI
let usedAI = false; // Track if AI was used in current session
let playerNameEntered = false; // Track if name already entered for this session

let leaderboardData = {};
let timerInterval;

async function fetchGame() {
    try {
        const res = await fetch('/init');
        if (!res.ok) throw new Error('Failed to fetch game');
        game = await res.json();
        if (game.grid && game.grid.length > 0) {
            renderGrid();
        }
    } catch (error) {
        console.error('Error fetching game:', error);
    }
}

async function startGame() {
    if (typeof timerInterval !== 'undefined' && timerInterval !== null) {
        clearInterval(timerInterval);
    }

    const statusEl = document.getElementById('status');
    if (statusEl) {
        statusEl.textContent = 'Loading...';
        statusEl.className = 'status-progress';
    }

    try {
        timerInterval = setInterval(() => {
            if (game && game.game_started && !game.completed) {
                updateGameStatus(game.valid !== false, game.completed);
            }
        }, 1000);

        const res = await fetch('/start_game', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({grid_size: currentGridSize})
        });
        if (!res.ok) throw new Error('Failed to start game');
        
        game = await res.json();
        game.hint_count = 0;
        
        // Show generation feedback
        if (game.generation_success === false && game.message) {
            alert(game.message);
        } else if (game.generation_attempts && game.generation_time) {
            const genTime = (game.generation_time * 1000).toFixed(3);
            console.log(`✅ Puzzle generated in ${game.generation_attempts} attempt(s) (${genTime}ms)`);
        }

        document.getElementById('start-screen').style.display = 'none';
        document.getElementById('game-controls').style.display = 'block';
        
        updateGridSize();
        renderGrid();
        
        // Force an initial status update to show "In Progress" immediately
        updateGameStatus(true, false);

    } catch (error) {
        console.error('Error starting game:', error);
    }
}

function renderGrid() {
    const grid = document.getElementById('grid');
    grid.innerHTML = '';
    
    // Don't render if no game grid
    if (!game || !game.grid || game.grid.length === 0) {
        return;
    }
    
    // Update timer if game exists
    if (game) {
        updateGameStatus(game.valid !== false, game.completed);
    }
    
    for (let y = 0; y < game.grid.length; y++) {
        for (let x = 0; x < game.grid[y].length; x++) {
            const val = game.grid[y][x];
            const cell = document.createElement('div');
            cell.className = val ? 'cell island' : 'cell empty';
            cell.style.gridColumn = x + 1;
            cell.style.gridRow = y + 1;
            cell.dataset.x = x;
            cell.dataset.y = y;
            
            if (val) {
                cell.textContent = val;
                
                // Drag start on islands
                cell.onmousedown = (e) => {
                    e.preventDefault();
                    dragStart = {x, y};
                    isDragging = true;
                    cell.style.background = '#3498db';
                    cell.style.border = '3px solid #2980b9';
                };
                
                // Drag over islands
                cell.onmouseenter = (e) => {
                    if (isDragging && dragStart && (dragStart.x !== x || dragStart.y !== y)) {
                        if (canConnectIslands(dragStart, {x, y})) {
                            cell.style.background = '#2ecc71';
                            showDragPreview(dragStart, {x, y});
                        } else {
                            cell.style.background = '#e74c3c';
                        }
                    }
                };
                
                cell.onmouseleave = (e) => {
                    if (isDragging && dragStart && (dragStart.x !== x || dragStart.y !== y)) {
                        updateCellColor(x, y);
                        clearDragPreview();
                    }
                };
                
                // Drag end on islands
                cell.onmouseup = async (e) => {
                    if (isDragging && dragStart && (dragStart.x !== x || dragStart.y !== y)) {
                        if (canConnectIslands(dragStart, {x, y})) {
                            await tryAddBridge(dragStart, {x, y});
                        }
                    }
                    resetDrag();
                };
            } else {
                // Empty cells - click to create bridges
                cell.onclick = async (e) => {
                    e.preventDefault();
                    await clickEmptyCell(x, y);
                };
                
                cell.onmouseenter = () => {
                    if (isDragging) {
                        // Show preview line through empty cells
                        updateDragPreview();
                    }
                };
            }
            grid.appendChild(cell);
        }
    }
    renderBridges();
}

function renderBridges() {
    const grid = document.getElementById('grid');
    // Remove old bridges
    document.querySelectorAll('.bridge').forEach(b => b.remove());
    
    for (const b of game.bridges) {
        const [x1, y1, x2, y2, count] = b;
        
        const bridge = document.createElement('div');
        bridge.className = 'bridge';
        bridge.title = `Bridge (${count})`;
        
        // Horizontal
        if (y1 === y2) {
            bridge.classList.add('horizontal');
            bridge.style.gridRow = y1 + 1;
            bridge.style.gridColumn = `${Math.min(x1, x2) + 1} / ${Math.max(x1, x2) + 2}`;
            
            if (count === 2) {
                // Create two separate lines with gap
                bridge.style.height = '2px';
                bridge.style.alignSelf = 'center';
                bridge.style.justifySelf = 'stretch';
                bridge.style.marginTop = '-3px';
                
                // Create second bridge line
                const bridge2 = document.createElement('div');
                bridge2.className = 'bridge horizontal';
                bridge2.style.gridRow = y1 + 1;
                bridge2.style.gridColumn = `${Math.min(x1, x2) + 1} / ${Math.max(x1, x2) + 2}`;
                bridge2.style.height = '2px';
                bridge2.style.alignSelf = 'center';
                bridge2.style.justifySelf = 'stretch';
                bridge2.style.marginTop = '3px';
                bridge2.onclick = bridge.onclick;
                grid.appendChild(bridge2);
            } else {
                bridge.style.height = '3px';
                bridge.style.alignSelf = 'center';
                bridge.style.justifySelf = 'stretch';
            }
        }
        // Vertical
        else if (x1 === x2) {
            bridge.classList.add('vertical');
            bridge.style.gridColumn = x1 + 1;
            bridge.style.gridRow = `${Math.min(y1, y2) + 1} / ${Math.max(y1, y2) + 2}`;
            
            if (count === 2) {
                // Create two separate lines with gap
                bridge.style.width = '2px';
                bridge.style.justifySelf = 'center';
                bridge.style.alignSelf = 'stretch';
                bridge.style.marginLeft = '-3px';
                
                // Create second bridge line
                const bridge2 = document.createElement('div');
                bridge2.className = 'bridge vertical';
                bridge2.style.gridColumn = x1 + 1;
                bridge2.style.gridRow = `${Math.min(y1, y2) + 1} / ${Math.max(y1, y2) + 2}`;
                bridge2.style.width = '2px';
                bridge2.style.justifySelf = 'center';
                bridge2.style.alignSelf = 'stretch';
                bridge2.style.marginLeft = '3px';
                bridge2.onclick = bridge.onclick;
                grid.appendChild(bridge2);
            } else {
                bridge.style.width = '3px';
                bridge.style.justifySelf = 'center';
                bridge.style.alignSelf = 'stretch';
            }
        }
        
        bridge.onclick = async () => {
            await tryRemoveBridge({x: x1, y: y1}, {x: x2, y: y2});
        };
        grid.appendChild(bridge);
    }
    
    // Update island colors based on completion
    updateIslandColors();
}

function updateCellColor(x, y) {
    const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
    const required = game.grid[y][x];
    
    if (required) {
        // Check if hint feedback exists
        const feedbackKey = `${x},${y}`;
        if (game.hint_feedback && game.hint_feedback[feedbackKey]) {
            const feedback = game.hint_feedback[feedbackKey];
            if (feedback === 'correct') {
                cell.style.background = '#2ecc71'; // Green - correct
                cell.style.boxShadow = '0 0 15px #2ecc71';
            } else if (feedback === 'error') {
                cell.style.background = '#e74c3c'; // Red - error
                cell.style.boxShadow = '0 0 15px #e74c3c';
            } else {
                cell.style.background = '#ecf0f1'; // Default - neutral
                cell.style.boxShadow = 'none';
            }
        } else {
            // Default neutral appearance
            cell.style.background = '#ecf0f1';
            cell.style.boxShadow = 'none';
        }
        
        // Show current/required count
        let current = 0;
        game.bridges.forEach(b => {
            if ((b[0] === x && b[1] === y) || (b[2] === x && b[3] === y)) {
                current += b[4];
            }
        });
        cell.title = `${current}/${required} bridges`;
    } else {
        cell.style.background = 'transparent';
        cell.style.boxShadow = 'none';
    }
}

function updateIslandColors() {
    for (let y = 0; y < game.grid.length; y++) {
        for (let x = 0; x < game.grid[y].length; x++) {
            updateCellColor(x, y);
        }
    }
}

function showHintBridge(hint) {
    const grid = document.getElementById('grid');
    const hintElement = document.createElement('div');
    hintElement.className = 'hint-bridge';
    
    // Style the hint bridge
    if (hint.y1 === hint.y2) { // Horizontal
        hintElement.style.gridRow = hint.y1 + 1;
        hintElement.style.gridColumn = `${Math.min(hint.x1, hint.x2) + 1} / ${Math.max(hint.x1, hint.x2) + 2}`;
        hintElement.style.height = '4px';
        hintElement.style.alignSelf = 'center';
        hintElement.style.justifySelf = 'stretch';
    } else { // Vertical
        hintElement.style.gridColumn = hint.x1 + 1;
        hintElement.style.gridRow = `${Math.min(hint.y1, hint.y2) + 1} / ${Math.max(hint.y1, hint.y2) + 2}`;
        hintElement.style.width = '4px';
        hintElement.style.justifySelf = 'center';
        hintElement.style.alignSelf = 'stretch';
    }
    
    grid.appendChild(hintElement);
    
    // Remove hint after 1 second
    setTimeout(() => hintElement.remove(), 1000);
}

function resetDrag() {
    isDragging = false;
    dragStart = null;
    clearDragPreview();
    updateIslandColors();
}

function canConnectIslands(island1, island2) {
    // Must be orthogonal (same row or column)
    if (island1.x !== island2.x && island1.y !== island2.y) {
        return false;
    }
    
    // Check if path is clear (no islands in between)
    if (island1.x === island2.x) { // Vertical
        const minY = Math.min(island1.y, island2.y);
        const maxY = Math.max(island1.y, island2.y);
        for (let y = minY + 1; y < maxY; y++) {
            if (game.grid[y][island1.x] !== null) {
                return false;
            }
        }
    } else { // Horizontal
        const minX = Math.min(island1.x, island2.x);
        const maxX = Math.max(island1.x, island2.x);
        for (let x = minX + 1; x < maxX; x++) {
            if (game.grid[island1.y][x] !== null) {
                return false;
            }
        }
    }
    
    return true;
}

function showPossibleConnections(fromX, fromY) {
    for (let y = 0; y < game.grid.length; y++) {
        for (let x = 0; x < game.grid[y].length; x++) {
            if (game.grid[y][x] && (x !== fromX || y !== fromY)) {
                if (canConnect(fromX, fromY, x, y)) {
                    const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
                    cell.classList.add('possible-target');
                }
            }
        }
    }
}

function canConnect(x1, y1, x2, y2) {
    if (x1 !== x2 && y1 !== y2) return false; // Not horizontal or vertical
    
    // Check if path is clear
    if (x1 === x2) { // Vertical
        for (let y = Math.min(y1, y2) + 1; y < Math.max(y1, y2); y++) {
            if (game.grid[y][x1] !== null) return false;
        }
    } else { // Horizontal
        for (let x = Math.min(x1, x2) + 1; x < Math.max(x1, x2); x++) {
            if (game.grid[y1][x] !== null) return false;
        }
    }
    return true;
}

function findTargetIsland(startX, startY, clickX, clickY) {
    // Find island in the direction of the click
    const dx = clickX - startX;
    const dy = clickY - startY;
    
    if (dx === 0) { // Vertical direction
        const direction = dy > 0 ? 1 : -1;
        for (let y = startY + direction; y >= 0 && y < game.grid.length; y += direction) {
            if (game.grid[y][startX]) {
                return {x: startX, y: y};
            }
        }
    } else if (dy === 0) { // Horizontal direction
        const direction = dx > 0 ? 1 : -1;
        for (let x = startX + direction; x >= 0 && x < game.grid[0].length; x += direction) {
            if (game.grid[startY][x]) {
                return {x: x, y: startY};
            }
        }
    }
    return null;
}

function removePreviewLine() {
    if (previewLine) {
        previewLine.remove();
        previewLine = null;
    }
}

async function clickEmptyCell(x, y) {
    try {
        const res = await fetch('/click_cell', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({x: x, y: y})
        });
        if (!res.ok) throw new Error('Failed to click cell');
        const data = await res.json();
        const currentDifficulty = game && game.difficulty ? game.difficulty : 'Unknown';
        game = data.game;
        game.difficulty = currentDifficulty;
        renderGrid();
        
        if (data.complete) {
            showWinMessage();
        }
    } catch (error) {
        console.error('Error clicking cell:', error);
    }
}

async function submitScore(name, time, grid_size, is_ai = false) {
    try {
        const res = await fetch('/submit_score', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                name: name,
                time: time,
                grid_size: grid_size,
                is_ai: is_ai
            })
        });
        if (res.ok) {
            console.log('Score submitted successfully!');
            // Refresh leaderboard to show updated data
            await refreshLeaderboard();
        } else {
            console.error('Failed to submit score.', await res.json());
        }
    } catch (error) {
        console.error('Network error submitting score:', error);
    }
}

function showWinMessage() {
    const elapsed = game.elapsed_time || 0;
    const minutes = Math.floor(elapsed / 60);
    const seconds = Math.floor(elapsed % 60);
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    const gridSize = game.current_grid_size || currentGridSize;
    
    // Check if AI solved or player solved
    if (game.ai_solved) {
        // AI solved - ask for name only if not already entered
        if (!playerNameEntered) {
            const playerName = prompt('AI solved the puzzle! Enter your name to save your progress up to ' + (playerProgress) + 'x' + (playerProgress) + ':');
            if (playerName && playerName.trim()) {
                submitScore(playerName.trim(), elapsed, playerProgress, false);
                playerNameEntered = true;
            }
        }
        
        const message = document.createElement('div');
        message.className = 'win-message';
        message.innerHTML = `
            <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #3498db, #2980b9); color: white; border-radius: 10px; margin: 20px;">
                <h2>🤖 AI Solved! 🤖</h2>
                <p>Grid ${gridSize}x${gridSize} completed by AI!</p>
                <p>${playerNameEntered ? 'Your progress saved to leaderboard' : 'Progress not saved'}</p>
                <p>Time: ${timeStr}</p>
                <div style="margin-top: 20px;">
                    <button id="back-to-start-btn" style="padding: 10px 20px; margin: 5px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;">Back to 2x2</button>
                    <button id="ai-continue-btn" style="padding: 10px 20px; margin: 5px; background: #9b59b6; color: white; border: none; border-radius: 5px; cursor: pointer;">Let AI Continue</button>
                    <button id="exit-btn" style="padding: 10px 20px; margin: 5px; background: #e74c3c; color: white; border: none; border-radius: 5px; cursor: pointer;">Exit</button>
                </div>
            </div>
        `;
        document.body.appendChild(message);
        
        document.getElementById('back-to-start-btn').onclick = () => {
            message.remove();
            backTo2x2();
        };
        
        document.getElementById('ai-continue-btn').onclick = async () => {
            message.remove();
            await aiContinueProgression();
        };
        
        document.getElementById('exit-btn').onclick = () => {
            message.remove();
            exitToStart();
        };
    } else {
        // Player solved without AI - update progress
        playerProgress = Math.max(playerProgress, gridSize);
        
        let nextGridText = '';
        let nextGridButton = '';
        let stopButton = '';
        
        if (gridSize >= 15) {
            // Reached maximum - ask for name and go back to 2x2
            const playerName = prompt('🎉 Congratulations! You completed all grids! Enter your name for the leaderboard:');
            if (playerName && playerName.trim()) {
                submitScore(playerName.trim(), elapsed, gridSize, false);
            }
            nextGridText = '<p>🎉 Maximum grid size reached! Going back to 2x2.</p>';
            nextGridButton = `<button id="back-to-start-btn" style="padding: 10px 20px; margin: 5px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;">Back to 2x2</button>`;
        } else {
            // Can continue or stop
            nextGridButton = `<button id="next-grid-btn" style="padding: 10px 20px; margin: 5px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;">Next ${gridSize + 1}x${gridSize + 1} Grid</button>`;
            stopButton = `<button id="stop-btn" style="padding: 10px 20px; margin: 5px; background: #f39c12; color: white; border: none; border-radius: 5px; cursor: pointer;">Stop & Save Progress</button>`;
        }
        
        const message = document.createElement('div');
        message.className = 'win-message';
        message.innerHTML = `
            <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #2ecc71, #27ae60); color: white; border-radius: 10px; margin: 20px;">
                <h2>🎉 Congratulations! 🎉</h2>
                <p>Grid ${gridSize}x${gridSize} completed!</p>
                <p>Time: ${timeStr}</p>
                <p style="font-size: 16px; margin: 10px 0;">Ready for ${gridSize + 1}x${gridSize + 1} challenge?</p>
                ${nextGridText}
                <div style="margin-top: 20px;">
                    ${nextGridButton}
                    ${stopButton}
                    <button id="exit-btn" style="padding: 10px 20px; margin: 5px; background: #e74c3c; color: white; border: none; border-radius: 5px; cursor: pointer;">Exit</button>
                </div>
            </div>
        `;
        document.body.appendChild(message);
        
        if (gridSize >= 15) {
            document.getElementById('back-to-start-btn').onclick = () => {
                message.remove();
                backTo2x2();
            };
        } else {
            document.getElementById('next-grid-btn').onclick = async () => {
                message.remove();
                currentGridSize++;
                await startNextGrid();
            };
            
            document.getElementById('stop-btn').onclick = () => {
                const playerName = prompt('Enter your name to save your progress (' + gridSize + 'x' + gridSize + '):');
                if (playerName && playerName.trim()) {
                    submitScore(playerName.trim(), elapsed, gridSize, false);
                }
                message.remove();
                backTo2x2();
            };
        }
        
        document.getElementById('exit-btn').onclick = () => {
            message.remove();
            exitToStart();
        };
    }
}

async function fetchAndStoreLeaderboard() {
    try {
        const res = await fetch('/leaderboard'); 
        if (!res.ok) throw new Error('Failed to fetch leaderboard');
        
        leaderboardData = await res.json();
        return true;
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return false;
    }
}

function renderLeaderboardTable() {
    const scores = leaderboardData || [];
    const displayElement = document.getElementById('leaderboard-display');

    if (scores.length === 0) {
        displayElement.innerHTML = '<p>No scores recorded yet!</p>';
        return;
    }

    // Ensure we have an array
    let scoresArray = Array.isArray(scores) ? scores : [];
    
    const sortedScores = scoresArray.sort((a, b) => {
        if (a.grid_size !== b.grid_size) {
            return b.grid_size - a.grid_size; // Higher grid first
        }
        return a.time - b.time; // Lower time first for same grid
    });
    
    let html = '<table>';
    html += '<tr><th>Rank</th><th>Name</th><th>Highest Grid</th><th>Time</th></tr>';

    sortedScores.forEach((score, index) => {
        const minutes = Math.floor(score.time / 60);
        const seconds = Math.floor(score.time % 60);
        const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        let rankClass = '';
        if (index === 0) rankClass = 'rank-gold';
        else if (index === 1) rankClass = 'rank-silver';
        else if (index === 2) rankClass = 'rank-bronze';

        // Handle both old format (no is_ai field) and new format
        const isAI = score.is_ai === true || score.name === 'AI Backtracking Solver';
        const nameDisplay = isAI ? `🤖 ${score.name}` : score.name;
        const gridSize = score.grid_size || 3; // Default to 3 if missing

        html += `
            <tr class="${rankClass}">
                <td>${index + 1}</td>
                <td>${nameDisplay}</td>
                <td>${gridSize}x${gridSize}</td>
                <td>${timeStr}</td>
            </tr>
        `;
    });
    
    html += '</table>';
    displayElement.innerHTML = html;
}

async function initLeaderboard() {
    const success = await fetchAndStoreLeaderboard();
    if (success) {
        renderLeaderboardTable();
    } else {
        const displayElement = document.getElementById('leaderboard-display');
        if (displayElement) {
            displayElement.innerHTML = '<p>Could not load leaderboard data. Please check server connection.</p>';
        }
    }
}

// Refresh leaderboard after score submission
async function refreshLeaderboard() {
    await fetchAndStoreLeaderboard();
    renderLeaderboardTable();
}

window.onload = () => {
    if (document.querySelector('.leaderboard-container') && document.getElementById('leaderboard-display')) {
        // This is leaderboard.html
        initLeaderboard();
    } else if (document.getElementById('start-screen')) {
        document.getElementById('start-game').onclick = startGame;
    }
};




function updateGameStatus(valid, complete) {
    let status = document.getElementById('status');
    if (!status) {
        status = document.createElement('div');
        status.id = 'status';
        document.getElementById('controls').appendChild(status);
    }
    
    // Update timer display
    let timer = document.getElementById('timer');
    if (!timer) {
        timer = document.createElement('div');
        timer.id = 'timer';
        timer.style.margin = '10px 0';
        timer.style.fontSize = '18px';
        timer.style.fontWeight = 'bold';
        document.getElementById('controls').appendChild(timer);
    }
    
    // Calculate current elapsed time
    let elapsed = 0;
    if (game.game_started && game.start_time) {
        if (game.completed) {
            elapsed = game.elapsed_time;
        } else {
            const now = Date.now() / 1000;
            elapsed = Math.floor(now - game.start_time);
        }
    }
    
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    timer.textContent = `⏱️ Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    if (complete) {
        // --- CHECK FOR AI PENALTY HERE ---
        if (game.penalty) {
            status.textContent = `🤖 Puzzle Completed by AI! Git Gud`;
            status.className = 'status-ai-solved'; // Blue class
            timer.style.color = '#3498db'; // Blue text for timer
        } else {
            status.textContent = `✅ Puzzle Complete! Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
            status.className = 'status-complete'; // Green class
            timer.style.color = '#2ecc71'; // Green text for timer
        }
    } else if (!valid) {
        status.textContent = '❌ Invalid state';
        status.className = 'status-invalid';
        timer.style.color = '#e74c3c';
    } else {
        status.textContent = '🔄 In progress...';
        status.className = 'status-progress';
        timer.style.color = '#f39c12';
    }
}

function showDragPreview(island1, island2) {
    clearDragPreview();
    
    const grid = document.getElementById('grid');
    const preview = document.createElement('div');
    preview.className = 'drag-preview';
    
    // Style the preview bridge
    if (island1.y === island2.y) { // Horizontal
        preview.style.gridRow = island1.y + 1;
        preview.style.gridColumn = `${Math.min(island1.x, island2.x) + 1} / ${Math.max(island1.x, island2.x) + 2}`;
        preview.style.height = '3px';
        preview.style.alignSelf = 'center';
        preview.style.justifySelf = 'stretch';
    } else { // Vertical
        preview.style.gridColumn = island1.x + 1;
        preview.style.gridRow = `${Math.min(island1.y, island2.y) + 1} / ${Math.max(island1.y, island2.y) + 2}`;
        preview.style.width = '3px';
        preview.style.justifySelf = 'center';
        preview.style.alignSelf = 'stretch';
    }
    
    grid.appendChild(preview);
    currentPreview = preview;
}

function clearDragPreview() {
    if (currentPreview) {
        currentPreview.remove();
        currentPreview = null;
    }
}

function findPotentialConnections(x, y) {
    const connections = [];
    const adjacentIslands = [];
    
    // Check only immediate neighbors (distance 1)
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]; // left, right, up, down
    
    for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < game.grid[0].length && ny >= 0 && ny < game.grid.length) {
            if (game.grid[ny][nx]) {
                adjacentIslands.push({x: nx, y: ny});
            }
        }
    }
    
    // Only show preview if exactly 2 adjacent islands that are aligned
    if (adjacentIslands.length === 2) {
        const island1 = adjacentIslands[0];
        const island2 = adjacentIslands[1];
        
        // Check if they are aligned (same row or column)
        if (island1.x === island2.x || island1.y === island2.y) {
            connections.push({
                x1: island1.x, y1: island1.y,
                x2: island2.x, y2: island2.y
            });
        }
    }
    
    return connections;
}

async function tryAddBridge(a, b) {
    if (!game.grid[a.y][a.x] || !game.grid[b.y][b.x]) {
        return;
    }
    
    showBridgeAnimation(a, b);
    
    try {
        const res = await fetch('/add_bridge', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({x1: a.x, y1: a.y, x2: b.x, y2: b.y})
        });
        if (!res.ok) throw new Error('Failed to add bridge');
        const data = await res.json();
        const currentDifficulty = game && game.difficulty ? game.difficulty : 'Unknown';
        game = data.game;
        game.difficulty = currentDifficulty; // Restores the difficulty
        setTimeout(() => {
            renderGrid();
            if (data.complete) {
                showWinMessage();
            }
        }, 300);
    } catch (error) {
        console.error('Error adding bridge:', error);
        renderGrid();
    }
}

function showBridgeAnimation(a, b) {
    const grid = document.getElementById('grid');
    const animBridge = document.createElement('div');
    animBridge.className = 'bridge-animation';
    
    if (a.y === b.y) { // Horizontal
        animBridge.style.gridRow = a.y + 1;
        animBridge.style.gridColumn = Math.min(a.x, b.x) + 1 + ' / ' + (Math.max(a.x, b.x) + 2);
        animBridge.style.height = '4px';
        animBridge.style.marginTop = 'calc(50% - 2px)';
    } else { // Vertical
        animBridge.style.gridColumn = a.x + 1;
        animBridge.style.gridRow = Math.min(a.y, b.y) + 1 + ' / ' + (Math.max(a.y, b.y) + 2);
        animBridge.style.width = '4px';
        animBridge.style.marginLeft = 'calc(50% - 2px)';
    }
    
    grid.appendChild(animBridge);
    setTimeout(() => animBridge.remove(), 500);
}

async function tryRemoveBridge(a, b) {
    try {
        const res = await fetch('/remove_bridge', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({x1: a.x, y1: a.y, x2: b.x, y2: b.y})
        });
        if (!res.ok) throw new Error('Failed to remove bridge');
        const data = await res.json();
        const currentDifficulty = game && game.difficulty ? game.difficulty : 'Unknown';    
        game = data.game;
        game.difficulty = currentDifficulty; // Restores the difficulty
        renderGrid();
    } catch (error) {
        console.error('Error removing bridge:', error);
    }
}

// Global mouse up to handle drag end anywhere
document.onmouseup = () => {
    if (isDragging) {
        resetDrag();
    }
};

// Start game button
document.getElementById('start-game').onclick = async () => {
    await startGame();
};

document.getElementById('reset').onclick = async () => {
    const res = await fetch('/reset', {method: 'POST'});
    const data = await res.json();
    game = data;
    renderGrid();
};

document.getElementById('exit-game').onclick = async () => {
    // Check current puzzle completion status
    const isCurrentPuzzleComplete = game && game.completed;
    const currentGrid = game ? (game.current_grid_size || currentGridSize) : currentGridSize;
    
    let finalGrid = playerProgress;
    let message = '';
    
    if (isCurrentPuzzleComplete) {
        // Current puzzle is complete - use current grid as final score
        finalGrid = currentGrid;
        message = `Current puzzle (${currentGrid}x${currentGrid}) completed! This will be your final score.`;
    } else {
        // Current puzzle not complete - use previous progress
        message = `Current puzzle not completed. Your previous best (${playerProgress}x${playerProgress}) will be your final score.`;
    }
    
    // Ask for name if player has made progress beyond 2x2
    if (finalGrid > 2) {
        const confirmed = confirm(message + ' Save to leaderboard?');
        if (confirmed) {
            const playerName = prompt('Enter your name for the leaderboard:');
            if (playerName && playerName.trim()) {
                const elapsed = game ? (game.elapsed_time || 0) : 0;
                await submitScore(playerName.trim(), elapsed, finalGrid, false);
            }
        }
    }
    
    // STOP THE TIMER (CRITICAL STEP 1)
    if (typeof timerInterval !== 'undefined' && timerInterval !== null) {
        clearInterval(timerInterval);
        timerInterval = null; // Clear the variable after stopping
    }
    
    // FORCEFULLY REMOVE STATUS AND TIMER ELEMENTS (Most reliable cleanup)
    const statusElement = document.getElementById('status');
    if (statusElement) {
        statusElement.remove(); 
    }
    
    const timerElement = document.getElementById('timer');
    if (timerElement) {
        timerElement.remove(); 
    }

    // Reset UI and game data
    document.getElementById('start-screen').style.display = 'block';
    document.getElementById('game-controls').style.display = 'none';
    document.getElementById('grid').innerHTML = '';
    
    // Reset progress
    currentGridSize = 2;
    playerProgress = 2;
    
    // Update start button text
    const startBtn = document.getElementById('start-game');
    if (startBtn) {
        startBtn.textContent = '🎮 Start 2x2 Grid';
    }
    
    // Ensure the game object is reset
    game = {grid: [], bridges: []};
};

document.getElementById('solve').onclick = async () => {
    const btn = document.getElementById('solve');
    
    // Show confirmation dialog
    const confirmed = confirm('Using AI solver will end your current progress and save your highest achieved grid (' + playerProgress + 'x' + playerProgress + ') to the leaderboard. Continue?');
    if (!confirmed) {
        return;
    }
    
    btn.disabled = true;
    btn.textContent = 'AI Solving...';
    
    try {
        const res = await fetch('/solve', {method: 'POST'});
        const data = await res.json();
        
        btn.disabled = false;
        btn.textContent = '🤖 AI Solve';
        
        if (data.success) {
            game = data.game;
            
            if (data.penalty) {
                game.penalty = true; 
            }
            
            renderGrid();
            updateGameStatus(true, true);
            
            if (data.method === 'backtracking') {
                const aiTimeDisplay = data.ai_time_display || data.ai_solve_time.toFixed(6);
                alert(`🧠 Puzzle solved using backtracking algorithm!\nAI solve time: ${aiTimeDisplay} seconds\n\nNote: Leaderboard time uses your total elapsed time (${game.elapsed_time}s)`);
            }
            
            // Check if puzzle is complete and show win message
            if (game.completed) {
                showWinMessage();
            }
            
        } else {
            alert(`❌ ${data.error || 'Failed to solve puzzle!'}`);
        }
    } catch (error) {
        console.error("Error solving:", error);
        btn.disabled = false;
        btn.textContent = 'AI Solve';
    }
};

async function startNextGrid() {
    try {
        const res = await fetch('/next_grid', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({grid_size: currentGridSize})
        });
        if (!res.ok) throw new Error('Failed to start next grid');
        
        game = await res.json();
        game.hint_count = 0;
        
        // Show generation feedback
        if (game.generation_success === false && game.message) {
            alert(game.message);
        } else if (game.generation_attempts && game.generation_time) {
            const genTime = (game.generation_time * 1000).toFixed(3);
            console.log(`✅ ${currentGridSize}x${currentGridSize} generated in ${game.generation_attempts} attempt(s) (${genTime}ms)`);
        }
        
        // Sync currentGridSize with backend
        currentGridSize = game.current_grid_size;
        
        updateGridSize();
        renderGrid();
        updateGameStatus(true, false);
        
    } catch (error) {
        console.error('Error starting next grid:', error);
    }
}

function exitToStart() {
    // Check current puzzle completion status
    const isCurrentPuzzleComplete = game && game.completed;
    const currentGrid = game ? (game.current_grid_size || currentGridSize) : currentGridSize;
    
    let finalGrid = playerProgress;
    let message = '';
    
    if (isCurrentPuzzleComplete) {
        // Current puzzle is complete - use current grid as final score
        finalGrid = currentGrid;
        message = `Current puzzle (${currentGrid}x${currentGrid}) completed! This will be your final score.`;
    } else {
        // Current puzzle not complete - use previous progress
        message = `Current puzzle not completed. Your previous best (${playerProgress}x${playerProgress}) will be your final score.`;
    }
    
    // Ask for name if player has made progress beyond 2x2 and name not already entered
    if (finalGrid > 2 && !playerNameEntered) {
        const confirmed = confirm(message + ' Save to leaderboard?');
        if (confirmed) {
            const playerName = prompt('Enter your name for the leaderboard:');
            if (playerName && playerName.trim()) {
                const elapsed = game ? (game.elapsed_time || 0) : 0;
                submitScore(playerName.trim(), elapsed, finalGrid, false);
                playerNameEntered = true;
            }
        }
    }
    
    // Stop timer
    if (typeof timerInterval !== 'undefined' && timerInterval !== null) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    // Reset to start screen
    document.getElementById('start-screen').style.display = 'block';
    document.getElementById('game-controls').style.display = 'none';
    document.getElementById('grid').innerHTML = '';
    
    // Reset grid size and progress
    currentGridSize = 2;
    playerProgress = 2;
    playerNameEntered = false; // Reset for new session
    
    // Update start button text
    const startBtn = document.getElementById('start-game');
    if (startBtn) {
        startBtn.textContent = '🎮 Start 2x2 Grid';
    }
    
    // Clear status and timer elements
    const statusElement = document.getElementById('status');
    if (statusElement) statusElement.remove();
    
    const timerElement = document.getElementById('timer');
    if (timerElement) timerElement.remove();
    
    game = {grid: [], bridges: []};
}


async function backTo2x2() {
    currentGridSize = 2;
    playerProgress = 2; // Reset progress tracking
    playerNameEntered = false; // Reset for new session
    try {
        const res = await fetch('/start_game', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({grid_size: 2})
        });
        if (!res.ok) throw new Error('Failed to start 2x2 game');
        
        game = await res.json();
        game.hint_count = 0;
        
        updateGridSize();
        renderGrid();
        updateGameStatus(true, false);
        
    } catch (error) {
        console.error('Error starting 2x2 grid:', error);
    }
}

document.getElementById('hint').onclick = async () => {
    if (!game || !game.grid || game.grid.length === 0) {
        console.warn("Cannot use hint: Game not started.");
        return; 
    }
    
    // Call Server (Server applies penalty)
    const res = await fetch('/hint', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ game_state: game }) 
    });
    
    const data = await res.json();
    
    // Update Game Object. The server sends back the game with the start_time ALREADY shifted by 15s.
    if (data.game) {
        game = data.game; // Overwrite the game state with the server-provided one
        
        // Update grid and status immediately
        renderGrid(); 
        updateGameStatus(game.valid !== false, game.completed); 
    }
    
    if (data.hint) {
        showHintBridge(data.hint);
        tryAddBridge({x: data.hint.x1, y: data.hint.y1}, {x: data.hint.x2, y: data.hint.y2});
    }
};

document.getElementById('generate').onclick = async () => {
    // Clear existing timer
    if (typeof timerInterval !== 'undefined' && timerInterval !== null) {
        clearInterval(timerInterval);
    }

    // Restart the timer logic
    timerInterval = setInterval(() => {
        if (game && game.game_started && !game.completed) {
            updateGameStatus(game.valid !== false, game.completed);
        }
    }, 1000);

    const res = await fetch('/generate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({grid_size: currentGridSize})
    });
    const data = await res.json();
    game = data;
    
    // Show generation feedback
    if (game.generation_success === false && game.message) {
        alert(game.message);
    } else if (game.generation_attempts && game.generation_time) {
        const genTime = (game.generation_time * 1000).toFixed(3);
        console.log(`✅ New ${currentGridSize}x${currentGridSize} generated in ${game.generation_attempts} attempt(s) (${genTime}ms)`);
    }

    // Client-side resets
    game.hint_count = 0; 
    
    updateGridSize();
    renderGrid();
    
    // Force initial status reset
    updateGameStatus(true, false);
};

document.getElementById('back-to-2x2').onclick = async () => {
    await backTo2x2();
};

// Initialize leaderboard on page load
window.onload = () => {
    if (document.getElementById('leaderboard-display')) {
        initLeaderboard();
    }
    
    // Update current grid display
    const gridDisplay = document.getElementById('current-grid-display');
    if (gridDisplay) {
        gridDisplay.textContent = `${currentGridSize}x${currentGridSize}`;
    }
};

function updateGridSize() {
    const grid = document.getElementById('grid');
    const size = game.grid.length;
    
    // Scale cell size based on grid size
    let cellSize = 60;
    if (size > 10) {
        cellSize = Math.max(25, 500 / size); // Minimum 25px, scale down for larger grids
    } else if (size > 7) {
        cellSize = 45; // Medium size for 8-10 grids
    }
    
    grid.style.gridTemplateColumns = `repeat(${size}, ${cellSize}px)`;
    grid.style.gridTemplateRows = `repeat(${size}, ${cellSize}px)`;
    
    // Center the grid for better alignment
    grid.style.justifyContent = 'center';
    grid.style.alignContent = 'center';
    grid.style.margin = '20px auto';
    grid.style.maxWidth = '90vw';
    grid.style.maxHeight = '70vh';
    
    // Update grid display
    const gridDisplay = document.getElementById('current-grid-display');
    if (gridDisplay) {
        gridDisplay.textContent = `${size}x${size}`;
    }
    
    // Update start button text
    const startBtn = document.getElementById('start-game');
    if (startBtn) {
        startBtn.textContent = `🎮 Start ${currentGridSize}x${currentGridSize} Grid`;
    }
}

async function showGenerationProgression() {
    try {
        const res = await fetch('/generation_progressive', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({max_grid: 15})
        });
        
        if (!res.ok) throw new Error('Failed to get generation progression');
        
        const data = await res.json();
        
        let resultMessage = `🏗️ Puzzle Generation Results\n`;
        resultMessage += `Generated grids: ${data.total_generated}\n`;
        resultMessage += `Highest grid: ${data.highest_grid}x${data.highest_grid}\n\n`;
        resultMessage += 'Generation Stats by Grid:\n';
        resultMessage += '========================\n';
        
        Object.entries(data.results).forEach(([gridSize, stats]) => {
            const genTime = (stats.time * 1000).toFixed(3);
            const method = stats.success ? 'MST' : 'Fallback';
            resultMessage += `${gridSize}: ${stats.attempts} attempts (${genTime}ms) [${method}]\n`;
        });
        
        alert(resultMessage);
        
    } catch (error) {
        console.error('Error getting generation progression:', error);
        alert('Failed to get generation statistics');
    }
}

fetchGame();

async function aiContinueProgression() {
    let currentSize = 2; // Always start from 2x2
    let aiResults = [];
    let generationResults = [];
    
    // Start from 2x2 and go up to limit
    while (currentSize <= 15) {
        // Generate grid
        const res = await fetch('/next_grid', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({grid_size: currentSize})
        });
        
        if (!res.ok) {
            alert(`Failed to generate ${currentSize}x${currentSize} grid. AI progression stopped.`);
            break;
        }
        
        game = await res.json();
        
        // Check if generation failed
        if (game.generation_success === false && game.message) {
            alert(game.message + ` AI progression stopped at ${currentSize}x${currentSize}.`);
            break;
        }
        
        // Record generation stats
        if (game.generation_attempts && game.generation_time) {
            generationResults.push({
                grid: `${currentSize}x${currentSize}`,
                attempts: game.generation_attempts,
                time: game.generation_time,
                success: game.generation_success !== false
            });
        }
        
        updateGridSize();
        renderGrid();
        
        // Let AI solve this grid
        const solveRes = await fetch('/solve', {method: 'POST'});
        const solveData = await solveRes.json();
        
        if (!solveData.success) {
            alert(`AI failed to solve ${currentSize}x${currentSize} grid. Progression stopped.`);
            break;
        }
        
        game = solveData.game;
        renderGrid();
        updateGameStatus(true, true);
        
        // Record AI result
        const aiTime = solveData.ai_time_display || solveData.ai_solve_time.toFixed(6);
        aiResults.push({
            grid: `${currentSize}x${currentSize}`,
            time: aiTime,
            playerTime: game.elapsed_time
        });
        
        // Brief pause to show progression
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        currentSize++;
    }
    
    // Final message with detailed results
    const finalSize = Math.min(currentSize, 15);
    
    // Save results to file
    const progressionData = {
        timestamp: new Date().toISOString(),
        ai_results: aiResults,
        generation_results: generationResults,
        highest_grid: finalSize
    };
    
    try {
        await fetch('/save_progression_stats', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(progressionData)
        });
    } catch (error) {
        console.error('Failed to save progression stats:', error);
    }
    
    let resultMessage = `🤖 AI Backtracking Solver Results\n`;
    resultMessage += `Completed grids: ${aiResults.length}\n`;
    resultMessage += `Highest grid: ${finalSize}x${finalSize}\n\n`;
    resultMessage += 'AI Solve Times by Grid:\n';
    resultMessage += '========================\n';
    
    aiResults.forEach(result => {
        resultMessage += `${result.grid}: ${result.time}s (Total: ${result.playerTime}s)\n`;
    });
    
    // Add generation statistics
    if (generationResults.length > 0) {
        resultMessage += '\n🏗️ Puzzle Generation Stats:\n';
        resultMessage += '============================\n';
        
        generationResults.forEach(result => {
            const genTime = (result.time * 1000).toFixed(3);
            const method = result.success ? 'MST' : 'Fallback';
            resultMessage += `${result.grid}: ${result.attempts} attempts (${genTime}ms) [${method}]\n`;
        });
        
        resultMessage += '\n📁 Results saved to progression_stats.json';
    }
    
    alert(resultMessage);
    
    // Submit AI score to leaderboard using player time
    const elapsed = game.elapsed_time || 0;
    await submitScore('🤖 AI Backtracking Solver', elapsed, finalSize, true);
    
    // Go back to 2x2 after showing results
    await backTo2x2();
}