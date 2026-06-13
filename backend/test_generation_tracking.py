#!/usr/bin/env python3
"""
Test script to verify puzzle generation attempt tracking
"""

from game import Game
import time

def test_generation_tracking():
    """Test generation attempt tracking for different grid sizes"""
    
    print("Testing Puzzle Generation Attempt Tracking")
    print("=" * 50)
    
    game = Game()
    results = {}
    
    # Test generation for grids 2x2 through 10x10
    for size in range(2, 11):
        print(f"\nTesting {size}x{size} grid generation...")
        
        game.current_grid_size = size
        
        # Track generation time
        start_time = time.perf_counter()
        success = game.generate_progressive_puzzle()
        end_time = time.perf_counter()
        
        generation_time = end_time - start_time
        attempts = getattr(game, 'generation_attempts', 0)
        
        results[f"{size}x{size}"] = {
            'success': success,
            'attempts': attempts,
            'time_ms': generation_time * 1000,
            'method': 'MST' if success else 'Fallback'
        }
        
        print(f"  Success: {success}")
        print(f"  Attempts: {attempts}")
        print(f"  Time: {generation_time * 1000:.3f}ms")
        print(f"  Method: {'MST' if success else 'Fallback'}")
        
        # If generation failed, test fallback
        if not success:
            print(f"  Testing fallback for {size}x{size}...")
            game._create_simple_puzzle(size)
            fallback_attempts = getattr(game, 'generation_attempts', 0)
            print(f"  Fallback attempts: {fallback_attempts}")
    
    # Summary
    print("\n" + "=" * 50)
    print("GENERATION SUMMARY")
    print("=" * 50)
    
    total_successful = sum(1 for r in results.values() if r['success'])
    total_attempts = sum(r['attempts'] for r in results.values())
    avg_time = sum(r['time_ms'] for r in results.values()) / len(results)
    
    print(f"Total grids tested: {len(results)}")
    print(f"Successful generations: {total_successful}")
    print(f"Failed generations: {len(results) - total_successful}")
    print(f"Total attempts: {total_attempts}")
    print(f"Average generation time: {avg_time:.3f}ms")
    
    print("\nDetailed Results:")
    print("-" * 30)
    for grid_size, stats in results.items():
        status = "SUCCESS" if stats['success'] else "FAILED"
        print(f"{status} {grid_size}: {stats['attempts']} attempts ({stats['time_ms']:.3f}ms) [{stats['method']}]")
    
    # Find generation limit
    failed_grids = [size for size, stats in results.items() if not stats['success']]
    if failed_grids:
        print(f"\nGeneration limit reached at: {failed_grids[0]}")
    else:
        print(f"\nAll tested grids generated successfully!")

if __name__ == "__main__":
    test_generation_tracking()