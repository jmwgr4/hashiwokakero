# Hashiwokakero - Bridge Builder Game

A web-based implementation of the Japanese logic puzzle Hashiwokakero (Build the Bridges) with AI solver and progressive difficulty system.

## 🎮 Game Features

### Core Gameplay
- **Interactive Bridge Building**: Click and drag between islands or click empty cells to create bridges
- **Progressive Grid System**: Start with 2x2 grids and advance to 15x15 maximum
- **Real-time Validation**: Instant feedback on bridge placement and puzzle completion
- **Proper Hashi Rules**: Authentic Hashiwokakero constraints and validation

### AI & Assistance
- **Backtracking AI Solver**: Advanced constraint satisfaction algorithm with O(3^E) complexity
- **High-Precision Timing**: AI solve times displayed with microsecond precision (6 decimal places)
- **Unified Timer System**: AI uses same player timer for fair leaderboard comparison
- **Hint System**: Get suggestions with 15-second time penalty
- **Step-by-step Animation**: Watch AI solve puzzles in real-time

### Progression & Leaderboard
- **Grid-based Progression**: 2x2 → 3x3 → ... → 15x15 → back to 2x2
- **Leaderboard System**: Track highest grid achieved by players and AI
- **AI Progression Tracking**: Complete timing breakdown from 2x2 through highest achieved grid
- **Completion Tracking**: Separate entries for human players and AI solver
- **Time-based Scoring**: Best completion times for each grid size

## 🚀 Installation

1. **Delete existing .venv folder** (if running on different machine):
```bash
rmdir /s .venv    # Windows
rm -rf .venv      # Mac/Linux
```

2. **Create virtual environment**:
```bash
python -m venv .venv
```

3. **Activate virtual environment**:
```bash
.venv\Scripts\activate    # Windows
source .venv/bin/activate # Mac/Linux
```

4. **Install dependencies**:
```bash
pip install -r requirements.txt
```

5. **Run the application**:
```bash
cd backend
python app.py
```

6. **Open browser** to `http://localhost:5000`

## 🎯 How to Play

### Basic Controls
- **Bridge Creation**: Click empty spaces between islands or drag from island to island
- **Bridge Cycling**: Each click cycles through: 0 → 1 bridge → 2 bridges → 0
- **Bridge Removal**: Click existing bridges to remove them

### Game Objective
- Connect all islands with exactly the number of bridges shown on each island
- All islands must form one connected network
- Bridges cannot cross each other

### Progressive System
- Start with 2x2 grid and progress through larger sizes
- Complete each grid to unlock the next size
- Maximum grid size is 15x15, then returns to 2x2
- Use "Back to 2x2" button to restart progression anytime

## 📋 Game Rules

1. **Bridge Placement**: Bridges can only run horizontally or vertically
2. **No Crossing**: Bridges cannot cross other bridges
3. **Bridge Limits**: Maximum 2 bridges between any pair of islands
4. **Island Requirements**: Each island's number indicates required bridge count
5. **Connectivity**: All islands must be connected in a single network

## 🤖 AI Solver

### Algorithm Details
- **Method**: Backtracking with constraint satisfaction
- **Complexity**: O(3^E) where E is number of possible connections
- **Features**: Systematic search with pruning and validation
- **Performance**: Real-time solving with completion time tracking
- **Precision**: Microsecond-level timing using `time.perf_counter()`

### AI Integration
- **Timer Synchronization**: Uses same player timer for fair leaderboard comparison
- **Dual Timing Display**: Shows both AI algorithm time (microseconds) and total elapsed time
- **Progressive Solving**: "Let AI Continue" feature solves all grids from current to maximum
- **Detailed Results**: Complete timing breakdown for each grid solved
- **Leaderboard Integration**: Automatic submission as "🤖 AI Backtracking Solver"

### AI Timing Features
- **Algorithm Time**: Pure backtracking execution time (0.001234s format)
- **Player Time**: Total elapsed time used for leaderboard scoring
- **Progressive Results**: Grid-by-grid timing from 2x2 through highest achieved
- **Failure Feedback**: Clear messaging when MST limits or solver limits reached

## 📊 Leaderboard System

### Tracking Method
- **Grid-based Scoring**: Tracks highest grid size achieved by each player/AI
- **Time Recording**: Best completion time for highest grid reached
- **Player vs AI**: Separate tracking with visual indicators (🤖 for AI)
- **Automatic Updates**: Real-time leaderboard refresh after completions
- **Fair Comparison**: AI uses same timer system as human players

### Data Format
```json
[
  {
    "name": "Player Name",
    "time": 120,
    "grid_size": 8,
    "is_ai": false
  },
  {
    "name": "🤖 AI Backtracking Solver",
    "time": 45,
    "grid_size": 13,
    "is_ai": true
  }
]
```

## 🛠️ Technical Architecture

### Backend (Python/Flask)
- **game.py**: Core game logic, puzzle generation, validation, AI integration
- **solver.py**: Backtracking AI algorithm implementation with constraint satisfaction
- **app.py**: Flask API routes and leaderboard management with high-precision timing

### Frontend (HTML/CSS/JavaScript)
- **index.html**: Game interface and progressive UI
- **script.js**: Game interactions, AI integration, leaderboard, timing display
- **style.css**: Responsive styling with grid scaling

### Key Algorithms
1. **Puzzle Generation**: MST-based with Kruskal's algorithm
2. **AI Solver**: Backtracking constraint satisfaction with O(3^E) complexity
3. **Connectivity Check**: BFS graph traversal
4. **Bridge Validation**: Crossing detection and degree constraints
5. **High-Precision Timing**: `time.perf_counter()` for microsecond accuracy

## 🔧 Recent Changes & Updates

### Version 3.0 - Enhanced AI System
- ✅ **Unified Timer System**: AI uses same player timer for fair leaderboard comparison
- ✅ **High-Precision Timing**: Microsecond-level AI solve time display (6 decimal places)
- ✅ **Complete Progression Tracking**: AI results include starting grid (2x2) through final grid
- ✅ **Enhanced Feedback**: Clear messaging for MST limits, solver failures, and success scenarios
- ✅ **Detailed Results Display**: Grid-by-grid timing breakdown with both AI and total times

### Version 2.0 - Progressive System
- ✅ Implemented progressive grid system (2x2 to 15x15)
- ✅ Added grid size limits with automatic reset to 2x2
- ✅ Integrated AI solver with leaderboard tracking
- ✅ Added "Back to 2x2" functionality
- ✅ Improved grid scaling for larger sizes (10x10+)

### Leaderboard Overhaul
- ✅ Migrated from difficulty-based to grid-size-based tracking
- ✅ Added AI vs human player distinction
- ✅ Implemented highest grid achievement system
- ✅ Real-time leaderboard updates
- ✅ Fair timing system for AI vs human comparison

### UI/UX Improvements
- ✅ Responsive grid scaling (25px minimum for 15x15)
- ✅ Centered grid alignment for better visibility
- ✅ Progressive completion messages
- ✅ Integrated leaderboard in main interface
- ✅ High-precision timing display

### AI Enhancements
- ✅ Synchronized AI timing with player timer
- ✅ Proper completion time feedback with microsecond precision
- ✅ Automatic leaderboard integration
- ✅ Grid progression capability for AI
- ✅ Complete results tracking from 2x2 onwards

## 📁 Project Structure

```
Hashiwokakero/
├── backend/
│   ├── database/
│   │   └── leaderboard.json    # Grid-based leaderboard data
│   ├── app.py                  # Flask API server with timing
│   ├── game.py                 # Game logic & puzzle generation
│   ├── solver.py               # Backtracking AI solver
│   └── test_system.py          # System functionality tests
├── frontend/
│   ├── index.html              # Progressive game interface
│   ├── script.js               # Game interactions & AI integration
│   └── style.css               # Responsive styling
├── requirements.txt            # Python dependencies
├── start_game.bat              # Easy startup script
└── README.md                   # This documentation
```

## 🎮 Game Controls Reference

| Action | Method |
|--------|--------|
| Create Bridge | Click empty cell between islands |
| Drag Bridge | Click and drag from island to island |
| Remove Bridge | Click existing bridge |
| Get Hint | Click "💡 Hint" (15s penalty) |
| AI Solve | Click "🤖 AI Solve" |
| AI Continue | Click "Let AI Continue" (after AI solve) |
| Reset Puzzle | Click "🔄 Reset" |
| Generate New | Click "🎲 Generate Puzzle" |
| Back to 2x2 | Click "⬅️ Back to 2x2" |
| Exit Game | Click "❌ Exit Game" |

## 🏆 Achievement System

- **Grid Master**: Complete 15x15 grid
- **Speed Runner**: Complete any grid under 30 seconds
- **AI Challenger**: Beat AI completion time
- **Progressive Player**: Complete 10 consecutive grid sizes
- **Precision Master**: Achieve microsecond-level AI solve times

## 🔬 AI Performance Metrics

### Timing Display Format
- **AI Algorithm Time**: `0.001234s` (6 decimal places, microsecond precision)
- **Total Elapsed Time**: `45s` (used for leaderboard comparison)
- **Progressive Results**: Complete breakdown from 2x2 through final grid

### Example AI Results
```
🤖 AI Backtracking Solver Results
Completed grids: 12
Highest grid: 13x13

AI Solve Times by Grid:
========================
2x2: 0.000123s (Total: 2s)
3x3: 0.000456s (Total: 5s)
4x4: 0.001234s (Total: 8s)
...
13x13: 0.045678s (Total: 180s)
```

---

**Created by**: Bagabaldo, Ostos, Rollorata  
**Course**: CSC-108  
**Algorithm Focus**: Backtracking, MST, BFS, Constraint Satisfaction, High-Precision Timing