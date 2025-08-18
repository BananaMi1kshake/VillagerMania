// modules/pathfinding.js

export function findPath(start, end, grid, walkable, dynamicObstacles) {
    function Node(x, y, parent = null) {
        this.x = x;
        this.y = y;
        this.parent = parent;
        this.g = parent ? parent.g + 1 : 0;
        this.h = Math.abs(x - end.x) + Math.abs(y - end.y);
        this.f = this.g + this.h;
    }

    const openSet = [new Node(start.x, start.y)];
    const closedSet = new Set();

    while (openSet.length > 0) {
        openSet.sort((a, b) => a.f - b.f);
        const currentNode = openSet.shift();

        if (currentNode.x === end.x && currentNode.y === end.y) {
            const path = [];
            let current = currentNode;
            while (current) {
                path.unshift({ x: current.x, y: current.y });
                current = current.parent;
            }
            return path.slice(1);
        }

        closedSet.add(`${currentNode.x},${currentNode.y}`);

        const neighbors = [
            { x: currentNode.x, y: currentNode.y - 1 },
            { x: currentNode.x, y: currentNode.y + 1 },
            { x: currentNode.x - 1, y: currentNode.y },
            { x: currentNode.x + 1, y: currentNode.y }
        ];

        for (const neighborPos of neighbors) {
            if (neighborPos.y < 0 || neighborPos.y >= grid.length || neighborPos.x < 0 || neighborPos.x >= grid[neighborPos.y].length) {
                continue;
            }
            const neighborKey = `${neighborPos.x},${neighborPos.y}`;
            if (closedSet.has(neighborKey) || dynamicObstacles.has(neighborKey)) {
                continue;
            }
            const tile = grid[neighborPos.y][neighborPos.x];
            if (!walkable.includes(tile)) {
                continue;
            }
            const neighborNode = new Node(neighborPos.x, neighborPos.y, currentNode);
            const openNode = openSet.find(node => node.x === neighborNode.x && node.y === neighborNode.y);
            if (!openNode || neighborNode.g < openNode.g) {
                if (!openNode) {
                    openSet.push(neighborNode);
                } else {
                    openNode.parent = currentNode;
                    openNode.g = neighborNode.g;
                    openNode.f = neighborNode.f;
                }
            }
        }
    }
    return []; // No path found
}