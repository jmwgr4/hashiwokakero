from copy import deepcopy

def solve(game):
    """Solve Hashiwokakero puzzle using backtracking with constraint satisfaction"""
    
    # Get all islands
    islands = []
    for y in range(len(game.grid)):
        for x in range(len(game.grid[0])):
            if game.grid[y][x]:
                islands.append((x, y, game.grid[y][x]))
    
    if not islands:
        return []
    
    # Find all possible bridge connections
    possible_bridges = []
    for i, (x1, y1, _) in enumerate(islands):
        for j, (x2, y2, _) in enumerate(islands):
            if i >= j:
                continue
            # Check if islands can be connected (same row or column with clear path)
            if x1 == x2:  # vertical connection
                clear = True
                for y in range(min(y1, y2) + 1, max(y1, y2)):
                    if game.grid[y][x1] is not None:
                        clear = False
                        break
                if clear:
                    possible_bridges.append((x1, y1, x2, y2))
            elif y1 == y2:  # horizontal connection
                clear = True
                for x in range(min(x1, x2) + 1, max(x1, x2)):
                    if game.grid[y1][x] is not None:
                        clear = False
                        break
                if clear:
                    possible_bridges.append((x1, y1, x2, y2))
    
    def bridges_cross(b1, b2):
        """Check if two bridges cross each other"""
        x1, y1, x2, y2 = b1
        x3, y3, x4, y4 = b2
        
        # One horizontal, one vertical
        if y1 == y2 and x3 == x4:  # b1 horizontal, b2 vertical
            return (min(x1, x2) < x3 < max(x1, x2) and 
                    min(y3, y4) < y1 < max(y3, y4))
        elif x1 == x2 and y3 == y4:  # b1 vertical, b2 horizontal
            return (min(y1, y2) < y3 < max(y1, y2) and 
                    min(x3, x4) < x1 < max(x3, x4))
        return False
    
    def is_valid_assignment(assignment):
        """Check if current bridge assignment is valid"""
        degree_count = {(x, y): 0 for x, y, _ in islands}
        bridge_list = []
        
        for bridge, count in assignment.items():
            if count > 0:
                x1, y1, x2, y2 = bridge
                degree_count[(x1, y1)] += count
                degree_count[(x2, y2)] += count
                bridge_list.append((x1, y1, x2, y2))
        
        # Check degree constraints not exceeded
        for x, y, required_degree in islands:
            if degree_count[(x, y)] > required_degree:
                return False
        
        # Check no crossing bridges
        for i in range(len(bridge_list)):
            for j in range(i + 1, len(bridge_list)):
                if bridges_cross(bridge_list[i], bridge_list[j]):
                    return False
        
        return True
    
    def is_complete_solution(assignment):
        """Check if assignment is a complete valid solution"""
        if not is_valid_assignment(assignment):
            return False
        
        # Check all degrees are exactly satisfied
        degree_count = {(x, y): 0 for x, y, _ in islands}
        bridge_connections = {(x, y): [] for x, y, _ in islands}
        
        for bridge, count in assignment.items():
            if count > 0:
                x1, y1, x2, y2 = bridge
                degree_count[(x1, y1)] += count
                degree_count[(x2, y2)] += count
                bridge_connections[(x1, y1)].append((x2, y2))
                bridge_connections[(x2, y2)].append((x1, y1))
        
        # Check exact degrees
        for x, y, required_degree in islands:
            if degree_count[(x, y)] != required_degree:
                return False
        
        # Check connectivity using BFS
        if not islands:
            return True
        
        visited = set()
        queue = [(islands[0][0], islands[0][1])]
        
        while queue:
            current = queue.pop(0)
            if current in visited:
                continue
            visited.add(current)
            for neighbor in bridge_connections[current]:
                if neighbor not in visited:
                    queue.append(neighbor)
        
        return len(visited) == len(islands)
    
    def backtrack(assignment, bridge_idx):
        """Backtracking algorithm with pruning"""
        if bridge_idx == len(possible_bridges):
            return is_complete_solution(assignment)
        
        bridge = possible_bridges[bridge_idx]
        
        # Try 0, 1, or 2 bridges
        for count in [0, 1, 2]:
            assignment[bridge] = count
            
            if is_valid_assignment(assignment):
                if backtrack(assignment, bridge_idx + 1):
                    return True
            
            del assignment[bridge]
        
        return False
    
    # Solve using backtracking
    assignment = {}
    if backtrack(assignment, 0):
        # Convert solution to required format
        solution = []
        for bridge, count in assignment.items():
            if count > 0:
                x1, y1, x2, y2 = bridge
                solution.append({
                    'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2, 'count': count
                })
        return solution
    
    return []