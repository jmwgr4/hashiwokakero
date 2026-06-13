class Game:
    def __init__(self):
        self.grid = []
        self.bridges = []
        self.complete_solution = []
        self.full_solution = []
        self.hint_feedback = {}
        self.start_time = None
        self.end_time = None
        self.game_started = False
        self.difficulty = 'medium'
        self.current_grid_size = 2  # Start with 2x2
        self.ai_solve_time = 0
        self.ai_solved = False
        self.generation_attempts = 0

    def start_game(self, grid_size=None):
        """Initialize a new game with progressive grid size"""
        if grid_size:
            self.current_grid_size = grid_size
        
        success = self.generate_progressive_puzzle()
        if not success:
            # Generation failed - use fallback
            self._create_simple_puzzle(self.current_grid_size)
            
        self.start_time = None
        self.end_time = None
        self.game_started = False
        return success

    def reset(self):
        # Keep current puzzle but reset progress
        self.bridges = []
        self.hint_feedback = {}
        self.start_time = None
        self.end_time = None
        self.game_started = False

    def normalize_bridge_coords(self, x1, y1, x2, y2):
        if x1 == x2:
            if y1 > y2:
                return x2, y2, x1, y1
        else:
            if x1 > x2:
                return x2, y2, x1, y1
        return x1, y1, x2, y2

    def add_bridge(self, x1, y1, x2, y2):
        """Add bridge between islands (for drag and drop)"""
        if not self.game_started:
            import time
            self.start_time = time.time()
            self.game_started = True
        
        x1, y1, x2, y2 = self.normalize_bridge_coords(x1, y1, x2, y2)
        
        if not ((x1 == x2) ^ (y1 == y2)):
            return False
        
        if not (self.grid[y1][x1] and self.grid[y2][x2]):
            return False
        
        if not self.is_path_clear(x1, y1, x2, y2):
            return False
        
        if self.crosses_existing(x1, y1, x2, y2):
            return False
        
        return self.cycle_bridge(x1, y1, x2, y2)

    def remove_bridge(self, x1, y1, x2, y2):
        x1, y1, x2, y2 = self.normalize_bridge_coords(x1, y1, x2, y2)
        for i, b in enumerate(self.bridges):
            if b[0] == x1 and b[1] == y1 and b[2] == x2 and b[3] == y2:
                if b[4] > 1:
                    self.bridges[i][4] -= 1
                else:
                    self.bridges.pop(i)
                return True
        return False

    def crosses_existing(self, x1, y1, x2, y2):
        x1, y1, x2, y2 = self.normalize_bridge_coords(x1, y1, x2, y2)
        
        for b in self.bridges:
            bx1, by1, bx2, by2 = b[0], b[1], b[2], b[3]
            
            if (x1 == x2 and bx1 == bx2):
                continue
            if (y1 == y2 and by1 == by2):
                continue
            
            if y1 == y2 and bx1 == bx2:
                if (x1 < bx1 < x2 and by1 < y1 < by2):
                    return True
            
            if x1 == x2 and by1 == by2:
                if (y1 < by1 < y2 and bx1 < x1 < bx2):
                    return True
        
        return False

    def is_path_clear(self, x1, y1, x2, y2):
        if x1 == x2:
            for y in range(min(y1, y2) + 1, max(y1, y2)):
                if self.grid[y][x1] is not None:
                    return False
        else:
            for x in range(min(x1, x2) + 1, max(x1, x2)):
                if self.grid[y1][x] is not None:
                    return False
        return True

    def get_bridge_count(self, x, y):
        count = 0
        for b in self.bridges:
            if (b[0] == x and b[1] == y) or (b[2] == x and b[3] == y):
                count += b[4]
        return count

    def is_valid_state(self):
        for y in range(len(self.grid)):
            for x in range(len(self.grid[0])):
                if self.grid[y][x]:
                    if self.get_bridge_count(x, y) > self.grid[y][x]:
                        return False
        return True

    def is_complete(self):
        for y in range(len(self.grid)):
            for x in range(len(self.grid[0])):
                if self.grid[y][x]:
                    if self.get_bridge_count(x, y) != self.grid[y][x]:
                        return False
        
        is_complete = self.is_connected()
        
        # Stop timer when puzzle is completed
        if is_complete and self.game_started and not self.end_time:
            import time
            self.end_time = time.time()
        
        return is_complete

    def is_connected(self):
        islands = [(x, y) for y in range(len(self.grid)) for x in range(len(self.grid[0])) if self.grid[y][x]]
        if not islands:
            return True
        
        adj = {island: [] for island in islands}
        for b in self.bridges:
            adj[(b[0], b[1])].append((b[2], b[3]))
            adj[(b[2], b[3])].append((b[0], b[1]))
        
        visited = set()
        queue = [islands[0]]
        while queue:
            current = queue.pop(0)
            if current in visited:
                continue
            visited.add(current)
            for neighbor in adj[current]:
                if neighbor not in visited:
                    queue.append(neighbor)
        
        return len(visited) == len(islands)

    def generate_progressive_puzzle(self):
        """Generate puzzle based on current grid size with MST limit detection"""
        import random
        from copy import deepcopy
        
        size = self.current_grid_size
        target_islands = max(2, min(size, size * size // 4))  # Reasonable island density
        
        # Try multiple attempts with different island counts
        max_attempts = 100
        
        for attempt in range(max_attempts):
            self.grid = [[None for _ in range(size)] for _ in range(size)]
            self.bridges = []
            
            # Try different island counts for better generation success
            island_count = target_islands + random.randint(-1, 1) if target_islands > 2 else target_islands
            island_count = max(2, min(island_count, size * size // 2))
            
            islands = self._place_islands_with_spacing(size, size, island_count)
            if len(islands) < 2:
                continue
                
            self._connect_islands_procedurally(islands)
            self._finalize_island_degrees(islands)
            
            # Validate the generated puzzle
            if self._validate_puzzle(islands):
                self.complete_solution = deepcopy(self.bridges)
                self.full_solution = deepcopy(self.bridges)
                self.bridges = []
                self.hint_feedback = {}
                # Store generation attempts for feedback
                self.generation_attempts = attempt + 1
                return True  # Success
        
        # If generation failed, store max attempts and return False
        self.generation_attempts = max_attempts
        return False
    
    def _create_simple_puzzle(self, size):
        """Create a simple valid puzzle for given size"""
        from copy import deepcopy
        
        # Set generation attempts to 1 for fallback puzzle
        self.generation_attempts = 1
        
        if size == 2:
            # 2x2 - simple horizontal connection
            self.grid = [[1, 1], [None, None]]
            self.complete_solution = [[0, 0, 1, 0, 1]]
            self.full_solution = [[0, 0, 1, 0, 1]]
        else:
            # 3x3+ - use existing default
            self.grid = [
                [1, None, 2, None, 1][:size],
                [None, None, None, None, None][:size],
                [2, None, 4, None, 2][:size],
                [None, None, None, None, None][:size],
                [1, None, 2, None, 1][:size]
            ][:size]
            
            # Adjust for smaller grids
            if size == 3:
                self.grid = [[1, None, 1], [None, None, None], [1, None, 1]]
                solution_bridges = [[0, 0, 2, 0, 1], [0, 2, 2, 2, 1]]
            else:
                solution_bridges = [[0, 0, 2, 0, 1], [2, 0, 4, 0, 1], [0, 2, 2, 2, 2], 
                                   [2, 2, 4, 2, 2], [0, 4, 2, 4, 1], [2, 4, 4, 4, 1]]
            
            self.complete_solution = deepcopy(solution_bridges)
            self.full_solution = deepcopy(solution_bridges)
        
        self.bridges = []
        self.hint_feedback = {}

    def _place_islands_with_spacing(self, rows, cols, count):
        import random
        islands = []
        attempts = 0
        
        while len(islands) < count and attempts < 1000:
            x = random.randint(0, cols - 1)
            y = random.randint(0, rows - 1)
            
            if (x, y) not in islands:
                islands.append((x, y))
                self.grid[y][x] = 0
            
            attempts += 1
        
        return islands

    def _connect_islands_procedurally(self, islands):
        import random
        
        if len(islands) < 2:
            return
        
        # Find all possible connections with distances
        edges = []
        for i, island1 in enumerate(islands):
            for j, island2 in enumerate(islands):
                if i >= j:
                    continue
                if self._can_connect_islands(island1, island2):
                    x1, y1 = island1
                    x2, y2 = island2
                    distance = abs(x1 - x2) + abs(y1 - y2)
                    edges.append((distance, island1, island2))
        
        # Sort edges by distance for MST
        edges.sort()
        
        # Kruskal's algorithm for MST
        parent = {island: island for island in islands}
        
        def find(x):
            if parent[x] != x:
                parent[x] = find(parent[x])
            return parent[x]
        
        def union(x, y):
            px, py = find(x), find(y)
            if px != py:
                parent[px] = py
                return True
            return False
        
        # Create MST bridges
        mst_bridges = []
        for distance, island1, island2 in edges:
            if union(island1, island2):
                mst_bridges.append((island1, island2))
                if len(mst_bridges) == len(islands) - 1:
                    break
        
        # Add MST bridges with random counts
        for island1, island2 in mst_bridges:
            x1, y1 = island1
            x2, y2 = island2
            x1, y1, x2, y2 = self.normalize_bridge_coords(x1, y1, x2, y2)
            bridge_count = random.choice([1, 1, 2])
            self.bridges.append([x1, y1, x2, y2, bridge_count])
        
        # Validate connectivity - if not connected, force connections
        if not self._is_fully_connected(islands):
            self._force_connectivity(islands)

    def _can_connect_islands(self, island1, island2):
        x1, y1 = island1
        x2, y2 = island2
        
        if not ((x1 == x2) ^ (y1 == y2)):
            return False
        
        if not self.is_path_clear(x1, y1, x2, y2):
            return False
        
        return not self.crosses_existing(x1, y1, x2, y2)

    def _is_fully_connected(self, islands):
        """Check if all islands are connected through bridges"""
        if len(islands) <= 1:
            return True
        
        # Build adjacency list
        adj = {island: [] for island in islands}
        for bridge in self.bridges:
            x1, y1, x2, y2 = bridge[0], bridge[1], bridge[2], bridge[3]
            island1 = (x1, y1)
            island2 = (x2, y2)
            adj[island1].append(island2)
            adj[island2].append(island1)
        
        # BFS to check connectivity
        visited = set()
        queue = [islands[0]]
        
        while queue:
            current = queue.pop(0)
            if current in visited:
                continue
            visited.add(current)
            for neighbor in adj[current]:
                if neighbor not in visited:
                    queue.append(neighbor)
        
        return len(visited) == len(islands)
    
    def _force_connectivity(self, islands):
        """Force connections between disconnected components"""
        import random
        
        # Find all possible connections (ignore crossing for connectivity)
        all_edges = []
        for i, island1 in enumerate(islands):
            for j, island2 in enumerate(islands):
                if i >= j:
                    continue
                x1, y1 = island1
                x2, y2 = island2
                if (x1 == x2 or y1 == y2) and self.is_path_clear(x1, y1, x2, y2):
                    distance = abs(x1 - x2) + abs(y1 - y2)
                    all_edges.append((distance, island1, island2))
        
        all_edges.sort()
        
        # Keep adding bridges until connected
        for distance, island1, island2 in all_edges:
            if not self._is_fully_connected(islands):
                x1, y1 = island1
                x2, y2 = island2
                x1, y1, x2, y2 = self.normalize_bridge_coords(x1, y1, x2, y2)
                self.bridges.append([x1, y1, x2, y2, 1])
            else:
                break
    
    def _finalize_island_degrees(self, islands):
        # Calculate current degrees and set island numbers
        for x, y in islands:
            degree = 0
            for b in self.bridges:
                if (b[0] == x and b[1] == y) or (b[2] == x and b[3] == y):
                    degree += b[4]
            self.grid[y][x] = max(1, degree)  # Ensure at least 1
    
    def _validate_puzzle(self, islands):
        """Validate that puzzle follows all Hashi rules"""
        # Check connectivity
        if not self._is_fully_connected(islands):
            return False
        
        # Check no crossing bridges
        for i in range(len(self.bridges)):
            for j in range(i + 1, len(self.bridges)):
                if self._bridges_cross(self.bridges[i], self.bridges[j]):
                    return False
        
        # Check all islands have valid degrees (1-8)
        for x, y in islands:
            degree = self.grid[y][x]
            if degree < 1 or degree > 8:
                return False
        
        return True
    
    def _bridges_cross(self, b1, b2):
        """Check if two bridges cross"""
        x1, y1, x2, y2 = b1[0], b1[1], b1[2], b1[3]
        x3, y3, x4, y4 = b2[0], b2[1], b2[2], b2[3]
        
        # One horizontal, one vertical
        if y1 == y2 and x3 == x4:  # b1 horizontal, b2 vertical
            return (min(x1, x2) < x3 < max(x1, x2) and 
                    min(y3, y4) < y1 < max(y3, y4))
        elif x1 == x2 and y3 == y4:  # b1 vertical, b2 horizontal
            return (min(y1, y2) < y3 < max(y1, y2) and 
                    min(x3, x4) < x1 < max(x3, x4))
        return False

    def apply_time_penalty(self, seconds):
        """Subtracts time from start_time effectively adding to elapsed time"""
        if self.game_started and self.start_time:
            self.start_time -= seconds
            return True
        return False

    def get_hint(self):
        for solution_bridge in self.full_solution:
            sx1, sy1, sx2, sy2, scount = solution_bridge
            
            found = False
            for player_bridge in self.bridges:
                px1, py1, px2, py2, pcount = player_bridge
                if (sx1, sy1, sx2, sy2) == (px1, py1, px2, py2):
                    if pcount >= scount:
                        found = True
                    break
            
            if not found:
                return {'x1': sx1, 'y1': sy1, 'x2': sx2, 'y2': sy2, 'count': 1}
        
        return None

    def check_island_correctness(self):
        feedback = {}
        
        for y in range(len(self.grid)):
            for x in range(len(self.grid[0])):
                if self.grid[y][x] is not None:
                    current_count = self.get_bridge_count(x, y)
                    required_count = self.grid[y][x]
                    
                    if current_count == required_count:
                        feedback[f"{x},{y}"] = 'correct'
                    else:
                        feedback[f"{x},{y}"] = 'error' if current_count > required_count else 'incomplete'
        
        self.hint_feedback = feedback
        return feedback

    def apply_ai_solution(self):
        from solver import solve
        import time
        
        # Clear current progress
        self.bridges = []
        
        # Continue player timer during AI solving
        if not self.game_started:
            self.start_time = time.time()
            self.game_started = True
        
        # Record AI solve start time with high precision
        ai_start = time.perf_counter()
        
        # Use backtracking solver
        solution = solve(self)
        
        # Record AI solve end time
        ai_end = time.perf_counter()
        self.ai_solve_time = ai_end - ai_start
        
        if solution:
            # Convert solution format and apply
            for bridge_data in solution:
                x1, y1, x2, y2, count = bridge_data['x1'], bridge_data['y1'], bridge_data['x2'], bridge_data['y2'], bridge_data['count']
                self.bridges.append([x1, y1, x2, y2, count])
            
            # Mark as AI solved and complete the puzzle using player's timer
            self.ai_solved = True
            self.is_complete()  # This will set end_time using player's timer
            return True
        else:
            return False  # No solution found

    def add_bridge_at_position(self, x, y):
        """Connect nearest islands through clicked empty cell"""
        if not self.game_started:
            import time
            self.start_time = time.time()
            self.game_started = True
            
        if self.grid[y][x] is not None:
            return False
        
        # Find nearest islands in horizontal direction
        left_island = self.find_nearest_island(x, y, (-1, 0))
        right_island = self.find_nearest_island(x, y, (1, 0))
        
        if left_island and right_island:
            x1, y1 = left_island
            x2, y2 = right_island
            if self.is_path_clear(x1, y1, x2, y2):
                result = self.cycle_bridge(x1, y1, x2, y2)
                if result:
                    self.is_complete()
                return result
        
        # Find nearest islands in vertical direction
        up_island = self.find_nearest_island(x, y, (0, -1))
        down_island = self.find_nearest_island(x, y, (0, 1))
        
        if up_island and down_island:
            x1, y1 = up_island
            x2, y2 = down_island
            if self.is_path_clear(x1, y1, x2, y2):
                result = self.cycle_bridge(x1, y1, x2, y2)
                if result:
                    self.is_complete()
                return result
        
        return False
    
    def find_nearest_island(self, start_x, start_y, direction):
        """Find nearest island in given direction"""
        dx, dy = direction
        x, y = start_x + dx, start_y + dy
        
        while 0 <= x < len(self.grid[0]) and 0 <= y < len(self.grid):
            if self.grid[y][x] is not None:
                return x, y
            x, y = x + dx, y + dy
        return None
    
    def cycle_bridge(self, x1, y1, x2, y2):
        """Cycle bridge count: 0 -> 1 -> 2 -> 0"""
        x1, y1, x2, y2 = self.normalize_bridge_coords(x1, y1, x2, y2)
        
        for i, b in enumerate(self.bridges):
            if b[0] == x1 and b[1] == y1 and b[2] == x2 and b[3] == y2:
                if b[4] >= 2:
                    self.bridges.pop(i)
                    self.is_complete()
                    return True
                else:
                    if self.can_add_bridge_to_islands(x1, y1, x2, y2):
                        self.bridges[i][4] += 1
                        self.is_complete()
                        return True
                    else:
                        self.bridges.pop(i)
                        self.is_complete()
                        return True
        
        if ((x1 == x2) ^ (y1 == y2)) and self.grid[y1][x1] and self.grid[y2][x2]:
            if self.can_add_bridge_to_islands(x1, y1, x2, y2) and not self.crosses_existing(x1, y1, x2, y2):
                self.bridges.append([x1, y1, x2, y2, 1])
                self.is_complete()
                return True
        return False
    
    def can_add_bridge_to_islands(self, x1, y1, x2, y2):
        """Check if adding bridge would violate degree constraints"""
        current_count1 = self.get_bridge_count(x1, y1)
        current_count2 = self.get_bridge_count(x2, y2)
        
        max_degree1 = self.grid[y1][x1]
        max_degree2 = self.grid[y2][x2]
        
        return (current_count1 < max_degree1) and (current_count2 < max_degree2)
    
    def get_elapsed_time(self):
        """Get elapsed game time"""
        if not self.game_started:
            return 0
        
        import time
        end = self.end_time if self.end_time else time.time()
        return int(end - self.start_time)
    
    def to_dict(self):
        return {
            'grid': self.grid, 
            'bridges': self.bridges,
            'hint_feedback': self.hint_feedback,
            'elapsed_time': self.get_elapsed_time(),
            'completed': self.end_time is not None,
            'start_time': self.start_time,
            'game_started': self.game_started,
            'valid': self.is_valid_state() if self.grid else True,
            'difficulty': self.difficulty,
            'current_grid_size': self.current_grid_size,
            'ai_solve_time': self.ai_solve_time,
            'ai_solved': getattr(self, 'ai_solved', False),
            'generation_attempts': getattr(self, 'generation_attempts', 0)
        }