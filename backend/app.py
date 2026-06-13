from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
# Use package-qualified imports so modules resolve when deployed as a package
from backend.game import Game
from backend.solver import solve
import json
import os
import time
import sys

# Ensure the backend directory is in the python path for Vercel
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

app = Flask(__name__)
CORS(app)

game = Game()

# Global tracking for generation statistics
generation_stats = {}

# Define absolute path for frontend directory relative to this file
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), 'frontend')

# On Vercel, we must use /tmp for any file writing
if os.environ.get('VERCEL'):
    LEADERBOARD_FILE = '/tmp/leaderboard.json'
else:
    LEADERBOARD_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'database', 'leaderboard.json')

# --- LEADERBOARD HELPER FUNCTIONS ---
def load_leaderboard():
    """Reads the leaderboard data from the JSON file."""
    if not os.path.exists(LEADERBOARD_FILE):
        return []
    
    try:
        with open(LEADERBOARD_FILE, 'r') as f:
            data = json.load(f)
            
        # Handle old format conversion
        if isinstance(data, dict) and ('easy' in data or 'medium' in data or 'hard' in data):
            # Convert old format to new format
            new_data = []
            for difficulty, scores in data.items():
                for score in scores:
                    # Map difficulty to grid size (approximate)
                    grid_size = 3 if difficulty == 'easy' else (5 if difficulty == 'medium' else 7)
                    new_data.append({
                        'name': score['name'],
                        'time': score['time'],
                        'grid_size': grid_size,
                        'is_ai': False
                    })
            return new_data
        
        return data if isinstance(data, list) else []
    except Exception as e:
        print(f"Error loading leaderboard: {e}")
        return []

def save_leaderboard(data):
    """Writes the leaderboard data to the JSON file."""

    try:
        db_dir = os.path.dirname(LEADERBOARD_FILE)
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir, exist_ok=True)
        with open(LEADERBOARD_FILE, 'w') as f:
            json.dump(data, f, indent=2) 
        return True
    except Exception as e:
        print(f"Error saving leaderboard: {e}")
        return False


@app.route('/leaderboard', methods=['GET'])
def get_leaderboard():
    """Returns the entire leaderboard data, structured by difficulty."""
    data = load_leaderboard()
    return jsonify(data), 200

@app.route('/submit_score', methods=['POST'])
def submit_score_route():
    """Receives and saves a new score to the leaderboard."""
    try:
        score_data = request.get_json()
        name = score_data.get('name')
        time = score_data.get('time')
        grid_size = score_data.get('grid_size')
        is_ai = score_data.get('is_ai', False)
        
        if not all([name, time is not None, grid_size]):
            return jsonify({"error": "Missing required score data"}), 400

        leaderboard = load_leaderboard()
        
        # Check if player/AI exists and update highest grid
        player_found = False
        for entry in leaderboard:
            if entry['name'] == name:
                if grid_size > entry['grid_size']:
                    entry['grid_size'] = grid_size
                    entry['time'] = int(time)
                    entry['is_ai'] = is_ai
                player_found = True
                break
        
        if not player_found:
            leaderboard.append({
                "name": name,
                "time": int(time),
                "grid_size": grid_size,
                "is_ai": is_ai
            })
        
        leaderboard.sort(key=lambda x: (-x['grid_size'], x['time']))
            
        if save_leaderboard(leaderboard):
            return jsonify({"message": "Score submitted successfully"}), 201
        else:
            return jsonify({"error": "Server failed to save score"}), 500

    except Exception as e:
        print(f"Error during score submission: {e}")
        return jsonify({"error": "Internal server error", "detail": str(e)}), 500

@app.route('/')
def index():
    return send_from_directory(FRONTEND_DIR, 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory(FRONTEND_DIR, filename)

@app.route('/init', methods=['GET'])
def init():
    return jsonify({'grid': [], 'bridges': [], 'game_started': False})

@app.route('/start_game', methods=['POST'])
def start_game():
    data = request.json
    grid_size = data.get('grid_size', 2)
    
    # Track generation time
    gen_start = time.perf_counter()
    success = game.start_game(grid_size)
    gen_end = time.perf_counter()
    
    # Store generation stats
    generation_stats[f"{grid_size}x{grid_size}"] = {
        'attempts': getattr(game, 'generation_attempts', 0),
        'success': success,
        'time': gen_end - gen_start
    }

    response_data = game.to_dict()
    response_data['grid_size'] = grid_size
    response_data['generation_success'] = success
    response_data['generation_attempts'] = getattr(game, 'generation_attempts', 0)
    response_data['generation_time'] = gen_end - gen_start
    
    if not success:
        response_data['message'] = f"MST generator reached its limit at {grid_size}x{grid_size} (100 attempts). Using fallback puzzle."
    else:
        response_data['message'] = f"Puzzle generated successfully in {response_data['generation_attempts']} attempt(s)."

    return jsonify(response_data)

@app.route('/next_grid', methods=['POST'])
def next_grid():
    data = request.json or {}
    grid_size = data.get('grid_size', game.current_grid_size)
    game.current_grid_size = grid_size
    
    # Track generation time
    gen_start = time.perf_counter()
    success = game.start_game(game.current_grid_size)
    gen_end = time.perf_counter()
    
    # Store generation stats
    generation_stats[f"{grid_size}x{grid_size}"] = {
        'attempts': getattr(game, 'generation_attempts', 0),
        'success': success,
        'time': gen_end - gen_start
    }
    
    response_data = game.to_dict()
    response_data['generation_success'] = success
    response_data['generation_attempts'] = getattr(game, 'generation_attempts', 0)
    response_data['generation_time'] = gen_end - gen_start
    
    if not success:
        response_data['message'] = f"MST generator reached its limit at {grid_size}x{grid_size} (100 attempts). Using fallback puzzle."
    else:
        response_data['message'] = f"Puzzle generated successfully in {response_data['generation_attempts']} attempt(s)."
    
    return jsonify(response_data)

@app.route('/reset', methods=['POST'])
def reset_game():
    game.reset()
    return jsonify(game.to_dict())

@app.route('/add_bridge', methods=['POST'])
def add_bridge():
    data = request.json
    result = game.add_bridge(data['x1'], data['y1'], data['x2'], data['y2'])
    is_complete = game.is_complete()
    return jsonify({
        'success': result, 
        'game': game.to_dict(),
        'complete': is_complete
    })

@app.route('/remove_bridge', methods=['POST'])
def remove_bridge():
    data = request.json
    result = game.remove_bridge(data['x1'], data['y1'], data['x2'], data['y2'])
    return jsonify({'success': result, 'game': game.to_dict()})

@app.route('/click_cell', methods=['POST'])
def click_cell():
    data = request.json
    result = game.add_bridge_at_position(data['x'], data['y'])
    is_complete = game.is_complete()
    return jsonify({
        'success': result, 
        'game': game.to_dict(),
        'complete': is_complete,
        'valid': game.is_valid_state()
    })

@app.route('/solve', methods=['POST'])
def solve_route():
    try:
        success = game.apply_ai_solution()
        if success:
            ai_time = game.ai_solve_time
            return jsonify({
                'success': True,
                'game': game.to_dict(),
                'penalty': True,
                'method': 'backtracking',
                'ai_solve_time': ai_time,
                'ai_time_display': f"{ai_time:.6f}"  # 6 decimal places for microseconds
            })
        else:
            return jsonify({
                'success': False,
                'error': 'No solution found using backtracking',
                'game': game.to_dict()
            })
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/hint', methods=['POST'])
def hint_route():
    try:
        game.apply_time_penalty(15) 
        hint = game.get_hint()
        feedback = game.check_island_correctness()
        
        return jsonify({
            'hint': hint,
            'feedback': feedback,
            'game': game.to_dict() 
        })
    except Exception as e:
        return jsonify({'error': str(e), 'hint': None}), 500

@app.route('/generate', methods=['POST'])
def generate_puzzle():
    data = request.json
    grid_size = data.get('grid_size', game.current_grid_size)
    game.current_grid_size = grid_size
    
    # Track generation time
    gen_start = time.perf_counter()
    success = game.generate_progressive_puzzle()
    if not success:
        game._create_simple_puzzle(grid_size)
    gen_end = time.perf_counter()
    
    # Store generation stats
    generation_stats[f"{grid_size}x{grid_size}"] = {
        'attempts': getattr(game, 'generation_attempts', 0),
        'success': success,
        'time': gen_end - gen_start
    }
    
    # Reset timer for new puzzle
    game.start_time = time.time()
    game.end_time = None
    game.game_started = True

    response_data = game.to_dict()
    response_data['grid_size'] = grid_size
    response_data['generation_success'] = success
    response_data['generation_attempts'] = getattr(game, 'generation_attempts', 0)
    response_data['generation_time'] = gen_end - gen_start
    
    if not success:
        response_data['message'] = f"MST generator reached its limit at {grid_size}x{grid_size} (100 attempts). Using fallback puzzle."
    else:
        response_data['message'] = f"Puzzle generated successfully in {response_data['generation_attempts']} attempt(s)."
    
    return jsonify(response_data)

@app.route('/generation_stats', methods=['GET'])
def get_generation_stats():
    """Returns puzzle generation statistics for all grid sizes"""
    return jsonify({
        'generation_stats': generation_stats,
        'total_grids_generated': len(generation_stats)
    })

@app.route('/generation_progressive', methods=['POST'])
def generate_progressive_puzzles():
    """Generate puzzles progressively from 2x2 to specified limit, tracking all attempts"""
    data = request.json
    max_grid = data.get('max_grid', 15)
    
    results = {}
    current_grid = 2
    
    while current_grid <= max_grid:
        gen_start = time.perf_counter()
        game.current_grid_size = current_grid
        success = game.generate_progressive_puzzle()
        
        if not success:
            game._create_simple_puzzle(current_grid)
        
        gen_end = time.perf_counter()
        
        # Store detailed results
        grid_key = f"{current_grid}x{current_grid}"
        results[grid_key] = {
            'attempts': getattr(game, 'generation_attempts', 0),
            'success': success,
            'time': gen_end - gen_start,
            'method': 'MST' if success else 'Fallback'
        }
        
        # Update global stats
        generation_stats[grid_key] = results[grid_key]
        
        # Stop if we hit the generation limit
        if not success:
            break
            
        current_grid += 1
    
    return jsonify({
        'results': results,
        'highest_grid': current_grid - 1 if not success else current_grid,
        'total_generated': len(results)
    })

@app.route('/save_progression_stats', methods=['POST'])
def save_progression_stats():
    """Save AI progression statistics to JSON file"""
    try:
        data = request.get_json()
        
        if os.environ.get('VERCEL'):
            stats_file = '/tmp/progression_stats.json'
        else:
            stats_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'database', 'progression_stats.json')
            
        os.makedirs(os.path.dirname(stats_file), exist_ok=True)
        
        with open(stats_file, 'w') as f:
            json.dump(data, f, indent=2)
        
        return jsonify({'success': True, 'message': 'Stats saved successfully'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/favicon.ico')
def favicon():
    return '', 204

if __name__ == '__main__':
    app.run(debug=True)