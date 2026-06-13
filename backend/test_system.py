#!/usr/bin/env python3
"""
Simple test script to verify Hashiwokakero system functionality
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from game import Game
from solver import solve

def test_game_creation():
    """Test basic game creation and puzzle generation"""
    print("Testing game creation...")
    game = Game()
    
    # Test 2x2 grid
    success = game.start_game(2)
    print(f"2x2 grid generation: {'SUCCESS' if success else 'FALLBACK'}")
    print(f"Grid size: {len(game.grid)}x{len(game.grid[0])}")
    print(f"Islands found: {sum(1 for row in game.grid for cell in row if cell is not None)}")
    
    return game

def test_solver(game):
    """Test the backtracking solver"""
    print("\nTesting AI solver...")
    solution = solve(game)
    
    if solution:
        print(f"Solver found solution with {len(solution)} bridges")
        for bridge in solution:
            print(f"  Bridge: ({bridge['x1']},{bridge['y1']}) -> ({bridge['x2']},{bridge['y2']}) count={bridge['count']}")
        return True
    else:
        print("Solver could not find solution")
        return False

def test_bridge_operations(game):
    """Test bridge addition and removal"""
    print("\nTesting bridge operations...")
    
    # Reset game state
    game.reset()
    
    # Find two islands to connect
    islands = []
    for y in range(len(game.grid)):
        for x in range(len(game.grid[0])):
            if game.grid[y][x] is not None:
                islands.append((x, y))
    
    if len(islands) >= 2:
        x1, y1 = islands[0]
        x2, y2 = islands[1]
        
        # Test if islands can be connected
        if (x1 == x2 or y1 == y2) and game.is_path_clear(x1, y1, x2, y2):
            print(f"Attempting to connect islands at ({x1},{y1}) and ({x2},{y2})")
            
            # Test bridge cycling
            result1 = game.cycle_bridge(x1, y1, x2, y2)
            print(f"First bridge add: {'SUCCESS' if result1 else 'FAILED'}")
            print(f"Bridge count: {len(game.bridges)}")
            
            if game.bridges:
                bridge = game.bridges[0]
                print(f"Bridge: ({bridge[0]},{bridge[1]}) -> ({bridge[2]},{bridge[3]}) count={bridge[4]}")
            
            return True
    
    print("No suitable islands found for connection test")
    return False

def main():
    """Run all tests"""
    print("=" * 50)
    print("HASHIWOKAKERO SYSTEM TEST")
    print("=" * 50)
    
    try:
        # Test game creation
        game = test_game_creation()
        
        # Test bridge operations
        test_bridge_operations(game)
        
        # Test solver
        test_solver(game)
        
        print("\n" + "=" * 50)
        print("ALL TESTS COMPLETED")
        print("=" * 50)
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()