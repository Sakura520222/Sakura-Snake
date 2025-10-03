/* 贪吃蛇游戏（恢复原始A* AI + 保留紧急寻食） */
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreElement = document.getElementById('score');
    const startBtn = document.getElementById('start-btn');
    
    const gridSize = 30;
    const tileSize = canvas.width / gridSize;
    
    let snake = [{x: 10, y: 10}];
    let dx = 1;
    let dy = 0;
    let nextDx = 1;
    let nextDy = 0;
    
    let score = 0;
    let gameLoopId = null;
    let foods = [];
    let gameRunning = false;
    let gameInitialized = false;
    
    let difficulty = 1;
    let aiMode = false;
    let aiBtn = null;
    
    let lastFoodTime = Date.now();
    const FORCE_FOOD_TIMEOUT = 10000; // 紧急寻食阈值（10秒）
    const STARVING_THRESHOLD = FORCE_FOOD_TIMEOUT * 0.8; // 饥饿预警（8秒）
    
    let gameMode = 'normal';
    const dangerousPositions = new Set();
    const safePathPatterns = [];
    const MAX_DANGEROUS_RECORDS = 20;
    const positionHistory = [];
    const MAX_HISTORY_LENGTH = 30;
    const LOOP_DETECTION_THRESHOLD = 8;
    const WALL_THROUGH_BONUS = 15;
    const WALL_THROUGH_RISK_REDUCTION = 0.3;
    const WALL_THROUGH_THRESHOLD = 1.0;
    
    let gameSpeed = 150; // 默认速度
    let startTime = null; // 游戏开始时间
    let elapsedTime = 0; // 已经过的时间（毫秒）
    let timerInterval = null; // 计时器间隔ID
    
    /** 获取基础速度 */
    function getBaseSpeed() {
        // 使用独立的速度设置，不依赖于难度
        return gameSpeed;
    }
    
    /** 绘制游戏界面（保留紧急寻食视觉提示） */
    function draw() {
        ctx.fillStyle = '#e6f7ff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 绘制格子线
        ctx.strokeStyle = 'rgba(200,200,200,0.3)';
        ctx.lineWidth = 1;
        for (let i = 1; i < gridSize; i++) {
            ctx.beginPath();
            ctx.moveTo(i * tileSize, 0);
            ctx.lineTo(i * tileSize, canvas.height);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i * tileSize);
            ctx.lineTo(canvas.width, i * tileSize);
            ctx.stroke();
        }
        
        // 绘制蛇身
        snake.forEach((segment, index) => {
            ctx.fillStyle = index === 0 ? '#27ae60' : '#2ecc71';
            ctx.fillRect(segment.x * tileSize, segment.y * tileSize, tileSize - 1, tileSize - 1);
        });
        
        // 绘制食物（紧急寻食时最近食物标黄）
        const head = snake[0];
        const isStarving = Date.now() - lastFoodTime > FORCE_FOOD_TIMEOUT;
        let nearestFood = null;
        if (foods.length > 0) {
            nearestFood = foods.reduce((a, b) => 
                getWrappedDistance(head, a) < getWrappedDistance(head, b) ? a : b
            );
        }
        
        foods.forEach(food => {
            const isDangerous = dangerousPositions.has(`${food.x},${food.y}`);
            const isNearest = isStarving && food === nearestFood;
            ctx.fillStyle = isNearest ? '#f1c40f' : (isDangerous ? '#c0392b' : '#e74c3c');
            ctx.fillRect(food.x * tileSize, food.y * tileSize, tileSize - 1, tileSize - 1);
        });
        
        // 穿墙模式边界线
        if (gameMode === 'wallThrough') {
            ctx.strokeStyle = 'rgba(155, 89, 182, 0.3)';
            ctx.lineWidth = 2;
            ctx.strokeRect(0, 0, canvas.width, canvas.height);
        }
        
        // 紧急寻食提示（保留强化效果）
        const timeSinceFood = Date.now() - lastFoodTime;
        if (timeSinceFood > STARVING_THRESHOLD) {
            const flash = Math.sin(Date.now() * 0.001) > 0;
            ctx.fillStyle = flash ? '#ff0000' : 'rgba(231, 76, 60, 0.7)';
            ctx.font = '16px Arial';
            const remainingTime = Math.ceil((FORCE_FOOD_TIMEOUT - timeSinceFood) / 1000);
            ctx.fillText(`⚠️ 紧急寻食：剩余${remainingTime}秒`, 10, 20);
        }
        
        scoreElement.textContent = score;
    }
    
    /** 检查位置安全性 */
    function isSafe(x, y, checkDangerous = false) {
        let nx = x;
        let ny = y;
        if (gameMode === 'wallThrough') {
            nx = (x + gridSize) % gridSize;
            ny = (y + gridSize) % gridSize;
        } else {
            if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return false;
        }
        if (snake.some(segment => segment.x === nx && segment.y === ny)) return false;
        return !checkDangerous || !dangerousPositions.has(`${nx},${ny}`);
    }
    
    /** 计算穿墙模式下两点间最短距离 */
    function getWrappedDistance(pos, target) {
        const dx = Math.abs(pos.x - target.x);
        const wrappedDx = Math.min(dx, gridSize - dx);
        const dy = Math.abs(pos.y - target.y);
        const wrappedDy = Math.min(dy, gridSize - dy);
        return wrappedDx + wrappedDy;
    }
    
    /** 获取最近食物的距离 */
    function getNearestFoodDistance() {
        if (foods.length === 0) return Infinity;
        const head = snake[0];
        return Math.min(...foods.map(food => getWrappedDistance(head, food)));
    }
    
    /** 循环检测机制 */
    function isInLoop() {
        const head = snake[0];
        const currentPos = `${head.x},${head.y}`;
        const lastDir = `${dx},${dy}`;
        positionHistory.push({ pos: currentPos, dir: lastDir });
        
        if (positionHistory.length > MAX_HISTORY_LENGTH) {
            positionHistory.shift();
        }
        
        const sameDirCount = positionHistory.filter(rec => 
            rec.pos === currentPos && rec.dir === lastDir
        ).length;
        return sameDirCount >= LOOP_DETECTION_THRESHOLD;
    }
    
    /** 计算穿墙移动的收益（优化版） */
    function calculateWallThroughBenefit(originalPath, wrappedPath, head, target) {
        if (!originalPath.length || !wrappedPath.length) return 0;
        
        const originalCost = originalPath.length;
        const wrappedCost = wrappedPath.length;
        const distanceBenefit = originalCost / Math.max(wrappedCost, 1);
        
        // 计算穿墙后的位置优势
        const [wrapX, wrapY] = wrappedPath[0] ? wrappedPath[0].split(',').map(Number) : [head.x, head.y];
        const postWrapSpace = countFreeSpace({x: wrapX, y: wrapY}, snake, 4);
        const spaceBenefit = postWrapSpace / 10;
        
        const isStarving = Date.now() - lastFoodTime > FORCE_FOOD_TIMEOUT;
        const hungerBenefit = isStarving ? 3 : 0; // 紧急寻食时大幅增加穿墙收益
        
        // 评估路径风险（考虑穿墙后的安全性）
        const riskCost = isRiskyPath(wrappedPath) ? 0.8 : 0;
        
        // 评估穿墙后的战略位置
        const futureState = predictFutureState(wrappedPath, 3);
        const futureSpace = countFreeSpace(futureState.snake[0], futureState.snake, 5);
        const futureSpaceBenefit = futureSpace / 20;
        
        // 考虑蛇的长度对穿墙决策的影响
        const snakeLengthFactor = snake.length > 20 ? 1.5 : snake.length > 10 ? 1.2 : 1.0;
        
        // 考虑目标位置与边界的距离
        const targetToEdge = Math.min(target.x, gridSize-1-target.x, target.y, gridSize-1-target.y);
        const targetEdgeBenefit = targetToEdge < 3 ? 0.5 : 0;
        
        // 综合收益计算
        const baseBenefit = (distanceBenefit + spaceBenefit + hungerBenefit + futureSpaceBenefit + targetEdgeBenefit - riskCost) * WALL_THROUGH_RISK_REDUCTION;
        
        return baseBenefit * snakeLengthFactor;
    }
    
    /** 检测路径是否存在风险 */
    function isRiskyPath(path, focusOnSelfCollision = false, predictionSteps = 10) {
        const isStarving = Date.now() - lastFoodTime > FORCE_FOOD_TIMEOUT;
        if (isStarving && !focusOnSelfCollision) return false; // 紧急寻食时忽略非致命风险
        
        let tempSnake = [...snake];
        let tempDx = dx;
        let tempDy = dy;
        const originalLength = tempSnake.length;
        const isCrazyMode = difficulty === 4;
        const isWallThrough = gameMode === 'wallThrough';
        let hasSelfCollisionRisk = false;
        
        for (let i = 0; i < Math.min(path.length, predictionSteps); i++) {
            const dir = path[i];
            switch (dir) {
                case 'up': if (tempDy === 0) { tempDx = 0; tempDy = -1; } break;
                case 'down': if (tempDy === 0) { tempDx = 0; tempDy = 1; } break;
                case 'left': if (tempDx === 0) { tempDx = -1; tempDy = 0; } break;
                case 'right': if (tempDx === 0) { tempDx = 1; tempDy = 0; } break;
            }
            
            let headX = tempSnake[0].x + tempDx;
            let headY = tempSnake[0].y + tempDy;
            if (isWallThrough) {
                headX = (headX + gridSize) % gridSize;
                headY = (headY + gridSize) % gridSize;
            }
            const head = { x: headX, y: headY };
            
            if (tempSnake.some(s => s.x === head.x && s.y === head.y)) {
                hasSelfCollisionRisk = true;
                if (focusOnSelfCollision) return true;
            }
            
            tempSnake.unshift(head);
            tempSnake.pop();
            
            if (!focusOnSelfCollision && isInClosedLoop(head, tempSnake)) return true;
            
            if (!focusOnSelfCollision && !isStarving) {
                const requiredSpace = Math.min(isWallThrough ? 10 : 8, Math.floor(originalLength / 3));
                const freeSpace = countFreeSpace(head, tempSnake, requiredSpace);
                const spaceThreshold = isCrazyMode ? 0.8 : (isWallThrough ? 0.5 : 0.7);
                if (freeSpace < requiredSpace * requiredSpace * spaceThreshold) return true;
            }
        }
        return hasSelfCollisionRisk;
    }
    
    /** 多步预测函数 */
    function predictFutureState(path, steps) {
        let tempSnake = [...snake];
        let tempDx = dx;
        let tempDy = dy;
        let tempFoods = [...foods];
        const isWallThrough = gameMode === 'wallThrough';
        
        for (let i = 0; i < Math.min(path.length, steps); i++) {
            const dir = path[i];
            switch (dir) {
                case 'up': if (tempDy === 0) { tempDx = 0; tempDy = -1; } break;
                case 'down': if (tempDy === 0) { tempDx = 0; tempDy = 1; } break;
                case 'left': if (tempDx === 0) { tempDx = -1; tempDy = 0; } break;
                case 'right': if (tempDx === 0) { tempDx = 1; tempDy = 0; } break;
            }
            
            let headX = tempSnake[0].x + tempDx;
            let headY = tempSnake[0].y + tempDy;
            if (isWallThrough) {
                headX = (headX + gridSize) % gridSize;
                headY = (headY + gridSize) % gridSize;
            }
            const head = { x: headX, y: headY };
            
            // 检查是否吃到食物
            const foodIndex = tempFoods.findIndex(f => f.x === head.x && f.y === head.y);
            if (foodIndex !== -1) {
                tempFoods.splice(foodIndex, 1);
                tempSnake.push({ ...tempSnake[tempSnake.length - 1] }); // 增加蛇身
            }
            
            tempSnake.unshift(head);
            if (foodIndex === -1) {
                tempSnake.pop(); // 没吃到食物时移除尾部
            }
        }
        
        return { snake: tempSnake, foods: tempFoods };
    }
    
    /** A*路径规划算法（恢复原始核心） */
    function aStarPath(start, target, considerWallThrough = true, maxSteps = Infinity) {
        if (start.x === target.x && start.y === target.y) return [];
        const isStarving = Date.now() - lastFoodTime > FORCE_FOOD_TIMEOUT;
        
        const openSet = new Set([`${start.x},${start.y}`]);
        const closedSet = new Set();
        const cameFrom = new Map();
        const gScore = new Map([[`${start.x},${start.y}`, 0]]);
        const heuristic = gameMode === 'wallThrough' ? getWrappedDistance(start, target) : getHeuristic(start, target);
        const fScore = new Map([[`${start.x},${start.y}`, heuristic]]);
        
        let steps = 0;
        while (openSet.size > 0 && steps < maxSteps) {
            let current = null;
            let minF = Infinity;
            for (const key of openSet) {
                const f = fScore.get(key) || Infinity;
                if (f < minF) {
                    minF = f;
                    current = key;
                }
            }
            if (!current) break;
            
            const [x, y] = current.split(',').map(Number);
            if (x === target.x && y === target.y) {
                return reconstructPath(cameFrom, current);
            }
            
            openSet.delete(current);
            closedSet.add(current);
            steps++;
            
            const directions = [
                {dx: 0, dy: -1, dir: 'up'},
                {dx: 1, dy: 0, dir: 'right'},
                {dx: 0, dy: 1, dir: 'down'},
                {dx: -1, dy: 0, dir: 'left'}
            ];
            
            if (gameMode === 'wallThrough' && considerWallThrough) {
                directions.sort((a, b) => {
                    const currentIsEdgeX = x === 0 || x === gridSize - 1;
                    const currentIsEdgeY = y === 0 || y === gridSize - 1;
                    
                    // 智能边界方向排序：考虑蛇的长度、饥饿状态和战略位置
                    const snakeLength = snake.length;
                    const isLongSnake = snakeLength > 15;
                    
                    // 长蛇在边界时优先考虑穿墙
                    if ((currentIsEdgeX || currentIsEdgeY) && isLongSnake && !isStarving) {
                        if (currentIsEdgeX && (a.dx !== 0 || b.dx !== 0)) {
                            return Math.abs(b.dx) - Math.abs(a.dx);
                        }
                        if (currentIsEdgeY && (a.dy !== 0 || b.dy !== 0)) {
                            return Math.abs(b.dy) - Math.abs(a.dy);
                        }
                    }
                    
                    // 饥饿状态下优先直接路径
                    if (isStarving) {
                        const aIsWallThrough = (x + a.dx < 0 || x + a.dx >= gridSize || y + a.dy < 0 || y + a.dy >= gridSize);
                        const bIsWallThrough = (x + b.dx < 0 || x + b.dx >= gridSize || y + b.dy < 0 || y + b.dy >= gridSize);
                        if (aIsWallThrough && !bIsWallThrough) return 1;
                        if (!aIsWallThrough && bIsWallThrough) return -1;
                    }
                    
                    return 0;
                });
            }
            
            for (const dir of directions) {
                let nx = x + dir.dx;
                let ny = y + dir.dy;
                
                if (gameMode === 'wallThrough' && considerWallThrough) {
                    nx = (nx + gridSize) % gridSize;
                    ny = (ny + gridSize) % gridSize;
                } else if (!considerWallThrough) {
                    if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) continue;
                }
                
                const neighborKey = `${nx},${ny}`;
                if (!isSafe(nx, ny) || closedSet.has(neighborKey)) continue;
                
                // 智能穿墙成本计算
                const isWallThroughMove = (x + dir.dx < 0 || x + dir.dx >= gridSize || 
                                         y + dir.dy < 0 || y + dir.dy >= gridSize) && 
                                         gameMode === 'wallThrough' && considerWallThrough;
                
                // 考虑蛇长度、饥饿状态和战略位置的综合成本
                const snakeLength = snake.length;
                const isLongSnake = snakeLength > 15;
                const isVeryLongSnake = snakeLength > 25;
                
                let stepCost = 1;
                if (isWallThroughMove) {
                    if (isStarving) {
                        // 饥饿状态下大幅降低穿墙成本
                        stepCost = 0.3;
                    } else if (isVeryLongSnake) {
                        // 超长蛇在边界时穿墙成本更低
                        stepCost = 0.4;
                    } else if (isLongSnake) {
                        // 长蛇在边界时穿墙成本适中
                        stepCost = 0.6;
                    } else {
                        // 短蛇穿墙成本较高
                        stepCost = 0.8;
                    }
                    
                    // 考虑目标位置与边界的距离
                    const targetToEdge = Math.min(target.x, gridSize-1-target.x, target.y, gridSize-1-target.y);
                    if (targetToEdge < 3) {
                        stepCost *= 0.7; // 目标在边界附近时进一步降低穿墙成本
                    }
                }
                const tentativeGScore = (gScore.get(current) || 0) + stepCost;
                
                if (!openSet.has(neighborKey) || tentativeGScore < (gScore.get(neighborKey) || Infinity)) {
                    cameFrom.set(neighborKey, {prev: current, dir: dir.dir});
                    gScore.set(neighborKey, tentativeGScore);
                    const h = gameMode === 'wallThrough' && considerWallThrough
                        ? getWrappedDistance({x: nx, y: ny}, target) 
                        : getHeuristic({x: nx, y: ny}, target);
                    fScore.set(neighborKey, tentativeGScore + h);
                    openSet.add(neighborKey);
                }
            }
        }
        return [];
    }
    
    /** 路径规划启发式函数（保留紧急寻食权重） */
    function getHeuristic(pos, target) {
        const manhattan = Math.abs(pos.x - target.x) + Math.abs(pos.y - target.y);
        const spaceWeight = 10 / (countFreeSpace(pos, snake, 3) + 1);
        const isStarving = Date.now() - lastFoodTime > FORCE_FOOD_TIMEOUT;
        // 紧急寻食时增加距离权重，优先最短路径
        return isStarving ? manhattan * 2 + spaceWeight : manhattan + spaceWeight;
    }
    
    /** 重建路径 */
    function reconstructPath(cameFrom, current) {
        const path = [];
        while (cameFrom.has(current)) {
            const entry = cameFrom.get(current);
            path.unshift(entry.dir);
            current = entry.prev;
        }
        return path;
    }
    
    /** 计算指定区域内的自由空间 */
    function countFreeSpace(center, excludeSnake, customRadius = null) {
        const radius = customRadius || (gameMode === 'wallThrough' ? 10 : Math.min(7, Math.floor(snake.length / 4) + 3));
        let count = 0;
        const isCorner = (center.x === 0 || center.x === gridSize-1) && 
                        (center.y === 0 || center.y === gridSize-1);
        
        for (let x = center.x - radius; x <= center.x + radius; x++) {
            for (let y = center.y - radius; y <= center.y + radius; y++) {
                let nx = x;
                let ny = y;
                if (gameMode === 'wallThrough') {
                    nx = (x + gridSize) % gridSize;
                    ny = (y + gridSize) % gridSize;
                } else {
                    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) continue;
                }
                
                if (!excludeSnake.some(s => s.x === nx && s.y === ny)) {
                    count += isCorner ? 1.5 : 1;
                }
            }
        }
        return count;
    }
    
    /** 检测是否陷入闭环陷阱 */
    function isInClosedLoop(head, tempSnake) {
        const bodySet = new Set(tempSnake.slice(1).map(s => `${s.x},${s.y}`));
        const adjacent = [
            {x: head.x + 1, y: head.y},
            {x: head.x - 1, y: head.y},
            {x: head.x, y: head.y + 1},
            {x: head.x, y: head.y - 1}
        ];
        const blocked = adjacent.filter(p => {
            let px = p.x;
            let py = p.y;
            
            // 在穿墙模式下，将坐标规范化到网格范围内
            if (gameMode === 'wallThrough') {
                px = (px + gridSize) % gridSize;
                py = (py + gridSize) % gridSize;
            } else {
                // 在普通模式下，超出边界的位置视为被阻挡
                if (px < 0 || px >= gridSize || py < 0 || py >= gridSize) {
                    return true;
                }
            }
            return bodySet.has(`${px},${py}`);
        });
        const isCrazyMode = difficulty === 4;
        const isWallThrough = gameMode === 'wallThrough';
        
        const blockedThreshold = isWallThrough ? 3 : (isCrazyMode ? 2 : 3);
        if (blocked.length >= blockedThreshold) {
            const closedAreaSize = countFreeSpace(head, tempSnake, isWallThrough ? 8 : 7);
            return closedAreaSize < tempSnake.length * (isWallThrough ? 0.3 : (isCrazyMode ? 0.5 : 0.7));
        }
        return false;
    }
    
    /** 食物评估系统（穿墙模式优化版） */
    function evaluateFood(food, head) {
        const isStarving = Date.now() - lastFoodTime > FORCE_FOOD_TIMEOUT;
        const snakeLength = snake.length;
        const isWallThrough = gameMode === 'wallThrough';
        
        // 紧急寻食时智能评估
        if (isStarving) {
            const normalDistance = getWrappedDistance(head, food);
            const isLongSnake = snakeLength > 15;
            
            // 长蛇在饥饿状态下更倾向于穿墙
            if (isWallThrough && isLongSnake) {
                const normalPath = aStarPath(head, food, false);
                const wrappedPath = aStarPath(head, food, true);
                const useWallThrough = wrappedPath.length > 0 && 
                                      calculateWallThroughBenefit(normalPath, wrappedPath, head, food) > WALL_THROUGH_THRESHOLD;
                
                if (useWallThrough) {
                    return -wrappedPath.length * 0.8; // 穿墙路径有额外奖励
                }
            }
            return -normalDistance;
        }
        
        const normalPath = aStarPath(head, food, false);
        const wrappedPath = aStarPath(head, food, true);
        const useWallThrough = isWallThrough && 
                              wrappedPath.length > 0 && 
                              calculateWallThroughBenefit(normalPath, wrappedPath, head, food) > WALL_THROUGH_THRESHOLD;
        
        const path = useWallThrough ? wrappedPath : normalPath;
        if (path.length === 0) return -1;
        
        let baseScore = 0;
        
        const distance = isWallThrough ? getWrappedDistance(head, food) : path.length;
        const distanceScore = 100 / (distance + 1);
        const hasCollisionInNormal = isRiskyPath(normalPath, true);
        const wallThroughBonus = useWallThrough ? (hasCollisionInNormal ? WALL_THROUGH_BONUS + 8 : WALL_THROUGH_BONUS) : 0;
        
        const space = countFreeSpace(food, snake, 5);
        const spaceWeight = snakeLength < 15 ? 0.3 : 0.7;
        const spaceScore = space * spaceWeight;
        
        let positionScore = 0;
        if (isWallThrough) {
            const isNearEdge = head.x < 4 || head.x >= gridSize - 4 || 
                             head.y < 4 || head.y >= gridSize - 4;
            const snakeIsLong = snakeLength > 15;
            const snakeIsVeryLong = snakeLength > 25;
            
            // 根据蛇长度调整边界位置评分
            if (snakeIsVeryLong) {
                positionScore = isNearEdge ? 40 : 10;
            } else if (snakeIsLong) {
                positionScore = isNearEdge ? 30 : 5;
            } else {
                positionScore = isNearEdge ? 15 : 0;
            }
        } else if (snakeLength < 10) {
            const isCenter = Math.abs(food.x - gridSize/2) < 5 && Math.abs(food.y - gridSize/2) < 5;
            positionScore = isCenter ? 30 : -10;
        }
        
        const normalPathRisk = isRiskyPath(normalPath, true) ? 1 : 0;
        const safetyScore = isRiskyPath(path) 
            ? (isWallThrough ? -80 : -200) 
            : (useWallThrough && normalPathRisk ? 150 : 80);
        
        // 考虑食物位置与边界的战略价值
        const foodToEdge = Math.min(food.x, gridSize-1-food.x, food.y, gridSize-1-food.y);
        const edgeBonus = isWallThrough && foodToEdge < 3 ? 25 : 0;
        
        return distanceScore + spaceScore + positionScore + safetyScore + wallThroughBonus + edgeBonus;
    }
    
    /** 计算边界位置评分（穿墙模式优化版） */
    function getBoundaryScore(dir, head) {
        let nx = head.x + dir.dx;
        let ny = head.y + dir.dy;
        const isWallThrough = gameMode === 'wallThrough';
        const isStarving = Date.now() - lastFoodTime > FORCE_FOOD_TIMEOUT;
        const snakeLength = snake.length;
        
        if (isStarving) return 0; // 紧急寻食时不考虑边界评分
        
        if (isWallThrough) {
            nx = (nx + gridSize) % gridSize;
            ny = (ny + gridSize) % gridSize;
        }
        
        // 智能边界权重计算
        const isLongSnake = snakeLength > 15;
        const isVeryLongSnake = snakeLength > 25;
        
        let boundaryWeight, centerWeight;
        if (isWallThrough) {
            if (isVeryLongSnake) {
                boundaryWeight = 0.95; // 超长蛇优先边界
                centerWeight = 0.05;
            } else if (isLongSnake) {
                boundaryWeight = 0.85;
                centerWeight = 0.15;
            } else {
                boundaryWeight = 0.7;
                centerWeight = 0.3;
            }
        } else {
            boundaryWeight = snakeLength < 15 ? 0.5 : 0.8;
            centerWeight = 1 - boundaryWeight;
        }
        
        const boundaryDist = Math.min(nx, (gridSize-1)-nx, ny, (gridSize-1)-ny);
        const adjustedBoundaryDist = isWallThrough ? (6 - Math.min(boundaryDist, 6)) : boundaryDist;
        const centerDist = Math.abs(nx - (gridSize/2)) + Math.abs(ny - (gridSize/2));
        const isHeadingToEdge = boundaryDist < 3;
        const avoidsSelf = !snake.some(s => s.x === nx && s.y === ny);
        
        // 智能边界奖励计算
        let edgeBonus = 0;
        if (isWallThrough && isHeadingToEdge) {
            if (avoidsSelf) {
                // 根据蛇长度调整边界奖励
                if (isVeryLongSnake) {
                    edgeBonus = 35; // 超长蛇在边界有更大优势
                } else if (isLongSnake) {
                    edgeBonus = 25;
                } else {
                    edgeBonus = 15;
                }
            } else {
                edgeBonus = 10; // 即使有碰撞风险，边界也有一定价值
            }
        }
        
        // 考虑当前位置的战略价值
        const currentBoundaryDist = Math.min(head.x, gridSize-1-head.x, head.y, gridSize-1-head.y);
        const strategicBonus = isWallThrough && currentBoundaryDist < 2 && boundaryDist > 4 ? 10 : 0;
        
        return (adjustedBoundaryDist * boundaryWeight) + (centerDist * centerWeight) + edgeBonus + strategicBonus;
    }
    
    /** 寻找探索路径 */
    function findExplorationPath(head) {
        const isStarving = Date.now() - lastFoodTime > FORCE_FOOD_TIMEOUT;
        if (isStarving) return []; // 紧急寻食时不探索
        
        const isWallThrough = gameMode === 'wallThrough';
        for (const pattern of safePathPatterns) {
            const [dir, successRate] = pattern;
            let testX = head.x + (dir === 'right' ? 1 : dir === 'left' ? -1 : 0);
            let testY = head.y + (dir === 'down' ? 1 : dir === 'up' ? -1 : 0);
            
            if (isWallThrough) {
                testX = (testX + gridSize) % gridSize;
                testY = (testY + gridSize) % gridSize;
            }
            
            if (isSafe(testX, testY) && successRate > 0.7) {
                return [dir];
            }
        }
        
        const directions = [
            {dx: 0, dy: -1, dir: 'up'},
            {dx: 1, dy: 0, dir: 'right'},
            {dx: 0, dy: 1, dir: 'down'},
            {dx: -1, dy: 0, dir: 'left'}
        ];
        
        if (isWallThrough) {
            directions.sort((a, b) => {
                const aX = head.x + a.dx;
                const aY = head.y + a.dy;
                const aAfterWrapX = (aX + gridSize) % gridSize;
                const aAfterWrapY = (aY + gridSize) % gridSize;
                const aAvoidsSelf = !snake.some(s => s.x === aAfterWrapX && s.y === aAfterWrapY);
                const aBoundaryDist = Math.min(
                    aAfterWrapX, 
                    gridSize - 1 - aAfterWrapX,
                    aAfterWrapY, 
                    gridSize - 1 - aAfterWrapY
                );
                const bX = head.x + b.dx;
                const bY = head.y + b.dy;
                const bAfterWrapX = (bX + gridSize) % gridSize;
                const bAfterWrapY = (bY + gridSize) % gridSize;
                const bAvoidsSelf = !snake.some(s => s.x === bAfterWrapX && s.y === bAfterWrapY);
                const bBoundaryDist = Math.min(
                    bAfterWrapX, 
                    gridSize - 1 - bAfterWrapX,
                    bAfterWrapY, 
                    gridSize - 1 - bAfterWrapY
                );
                if (aAvoidsSelf && !bAvoidsSelf) return -1;
                if (!aAvoidsSelf && bAvoidsSelf) return 1;
                return aBoundaryDist - bBoundaryDist;
            });
        }
        
        const visited = new Set(snake.slice(0, 60).map(s => `${s.x},${s.y}`));
        const unvisitedDirs = directions.filter(dir => {
            let nx = head.x + dir.dx;
            let ny = head.y + dir.dy;
            if (isWallThrough) {
                nx = (nx + gridSize) % gridSize;
                ny = (ny + gridSize) % gridSize;
            }
            return isSafe(nx, ny) && !visited.has(`${nx},${ny}`);
        });
        
        if (unvisitedDirs.length > 0) {
            return [unvisitedDirs.sort((a, b) => getBoundaryScore(a, head) - getBoundaryScore(b, head))[0].dir];
        }
        
        return [directions
            .filter(dir => {
                let nx = head.x + dir.dx;
                let ny = head.y + dir.dy;
                if (isWallThrough) {
                    nx = (nx + gridSize) % gridSize;
                    ny = (ny + gridSize) % gridSize;
                }
                return isSafe(nx, ny);
            })
            .sort((a, b) => {
                const spaceA = countFreeSpace({x: (head.x + a.dx + gridSize) % gridSize, y: (head.y + a.dy + gridSize) % gridSize}, snake, 3);
                const spaceB = countFreeSpace({x: (head.x + b.dx + gridSize) % gridSize, y: (head.y + b.dy + gridSize) % gridSize}, snake, 3);
                return spaceB - spaceA;
            })[0]?.dir || 'right'];
    }
    
    /** 寻找替代逃生路径 */
    function findAlternativeEscape(head, targets) {
        const directions = [
            {dx: 0, dy: -1, dir: 'up'},
            {dx: 1, dy: 0, dir: 'right'},
            {dx: 0, dy: 1, dir: 'down'},
            {dx: -1, dy: 0, dir: 'left'}
        ];
        
        const validDirections = directions
            .filter(dir => {
                const nx = (head.x + dir.dx + gridSize) % gridSize;
                const ny = (head.y + dir.dy + gridSize) % gridSize;
                return isSafe(nx, ny, true);
            })
            .sort((a, b) => {
                const distA = Math.min(...targets.map(t => getWrappedDistance({x: head.x + a.dx, y: head.y + a.dy}, t)));
                const distB = Math.min(...targets.map(t => getWrappedDistance({x: head.x + b.dx, y: head.y + b.dy}, t)));
                return distA - distB;
            });
            
        return validDirections.length > 0 ? [validDirections[0].dir] : ['right'];
    }
    
    /** 紧急逃生机制（穿墙模式优化版） */
    function aiEscape() {
        const head = snake[0];
        const isWallThrough = gameMode === 'wallThrough';
        const inLoop = isInLoop();
        const snakeLength = snake.length;
        const isLongSnake = snakeLength > 15;
        const isVeryLongSnake = snakeLength > 25;
        const directions = [
            {dx: 0, dy: -1, dir: 'up'},
            {dx: 1, dy: 0, dir: 'right'},
            {dx: 0, dy: 1, dir: 'down'},
            {dx: -1, dy: 0, dir: 'left'}
        ];
        
        const escapeScores = directions
            .filter(dir => {
                let nx = head.x + dir.dx;
                let ny = head.y + dir.dy;
                if (isWallThrough) {
                    nx = (nx + gridSize) % gridSize;
                    ny = (ny + gridSize) % gridSize;
                }
                return isSafe(nx, ny);
            })
            .map(dir => {
                let posX = head.x + dir.dx;
                let posY = head.y + dir.dy;
                let wrapped = false;
                if (isWallThrough) {
                    const prevX = posX;
                    const prevY = posY;
                    posX = (posX + gridSize) % gridSize;
                    posY = (posY + gridSize) % gridSize;
                    wrapped = prevX !== posX || prevY !== posY;
                }
                const pos = {x: posX, y: posY};
                const space = countFreeSpace(pos, snake, 5);
                const nextPath = aStarPath(pos, foods[0] || {x: gridSize/2, y: gridSize/2});
                const originalDirectionHasCollision = snake.some(s => 
                    s.x === (head.x + dir.dx) && s.y === (head.y + dir.dy)
                );
                
                // 智能穿墙奖励计算
                let wrapBonus = 0;
                let loopBonus = 0;
                
                if (wrapped) {
                    // 根据蛇长度调整穿墙奖励
                    if (isVeryLongSnake) {
                        wrapBonus = originalDirectionHasCollision ? 80 : 60;
                    } else if (isLongSnake) {
                        wrapBonus = originalDirectionHasCollision ? 60 : 40;
                    } else {
                        wrapBonus = originalDirectionHasCollision ? 40 : 25;
                    }
                    
                    // 闭环陷阱中的穿墙有额外奖励
                    loopBonus = inLoop ? 120 : 0;
                }
                
                // 考虑边界位置的战略价值
                const boundaryDist = Math.min(pos.x, gridSize-1-pos.x, pos.y, gridSize-1-pos.y);
                const boundaryBonus = isWallThrough && boundaryDist < 3 ? 15 : 0;
                
                // 路径安全性和空间权重
                const pathSafety = nextPath.length > 0 ? 25 : 0;
                const spaceWeight = space * (isVeryLongSnake ? 1.2 : 1.0);
                
                return {
                    ...dir,
                    score: spaceWeight + pathSafety + wrapBonus + loopBonus + boundaryBonus
                };
            })
            .sort((a, b) => b.score - a.score);
        
        if (escapeScores.length > 0) {
            nextDx = escapeScores[0].dx;
            nextDy = escapeScores[0].dy;
        }
    }
    
    /** 寻找最佳食物目标（恢复原始A*逻辑） */
    function findBestFood(head) {
        if (foods.length === 0) return [];
        
        const isStarving = Date.now() - lastFoodTime > FORCE_FOOD_TIMEOUT;
        const isWallThrough = gameMode === 'wallThrough';
        
        if (isStarving) {
            // 紧急寻食时优先最近食物
            // 获取最近的食物
            let nearestFood = foods[0];
            let minDistance = getWrappedDistance(head, nearestFood);
            
            for (let i = 1; i < foods.length; i++) {
                const distance = getWrappedDistance(head, foods[i]);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestFood = foods[i];
                }
            }
            
            const nearestFoods = foods.filter(food => 
                getWrappedDistance(head, food) === minDistance
            );
            
            let bestPath = [];
            let minPathLength = Infinity;
            nearestFoods.forEach(food => {
                const path = aStarPath(head, food, true);
                if (path.length > 0 && path.length < minPathLength) {
                    minPathLength = path.length;
                    bestPath = path;
                }
            });
            
            if (bestPath.length === 0 && isWallThrough) {
                const target = nearestFoods[0];
                const deltaX = (target.x - head.x + gridSize) % gridSize;
                const deltaY = (target.y - head.y + gridSize) % gridSize;
                const dx = deltaX > gridSize/2 ? -1 : 1;
                const dy = deltaY > gridSize/2 ? -1 : 1;
                bestPath = dx !== 0 ? [dx > 0 ? 'right' : 'left'] : [dy > 0 ? 'down' : 'up'];
                if (!isSafe(head.x + dx, head.y + dy, true)) {
                    bestPath = findAlternativeEscape(head, nearestFoods);
                }
            }
            
            return bestPath;
        }
        
        // 正常状态评估（原始A*逻辑）
        let bestScore = -Infinity;
        let bestPath = [];
        foods.forEach(food => {
            const normalPath = aStarPath(head, food, false);
            const wrappedPath = aStarPath(head, food, true);
            const normalHasCollision = isRiskyPath(normalPath, true);
            const useWallThrough = isWallThrough && 
                                  wrappedPath.length > 0 && 
                                  (calculateWallThroughBenefit(normalPath, wrappedPath, head, food) > WALL_THROUGH_THRESHOLD || normalHasCollision);
            const path = useWallThrough ? wrappedPath : normalPath;
            
            if (path.length === 0) return;
            const score = evaluateFood(food, head);
            if (score > bestScore && !isRiskyPath(path)) {
                bestScore = score;
                bestPath = path;
            }
        });
        return bestPath;
    }
    
    /** 验证方向安全性 */
    function validateDirection(dx, dy) {
        const nx = (snake[0].x + dx + gridSize) % gridSize;
        const ny = (snake[0].y + dy + gridSize) % gridSize;
        return !snake.slice(1).some(s => s.x === nx && s.y === ny);
    }
    
    /** AI决策系统（恢复原始A*核心逻辑） */
    function aiMakeDecision() {
        const head = snake[0];
        const currentTime = Date.now();
        const isStarving = currentTime - lastFoodTime > FORCE_FOOD_TIMEOUT;
        const isCrazyMode = difficulty === 4;
        const isWallThrough = gameMode === 'wallThrough';
        const snakeLength = snake.length;
        
        // 紧急自撞规避
        const nextHeadX = head.x + nextDx;
        const nextHeadY = head.y + nextDy;
        const nextHeadHasCollision = snake.some(s => s.x === nextHeadX && s.y === nextHeadY);
        if (nextHeadHasCollision && isWallThrough) {
            const escapeDirs = [
                {dx: 0, dy: -1, dir: 'up'},
                {dx: 1, dy: 0, dir: 'right'},
                {dx: 0, dy: 1, dir: 'down'},
                {dx: -1, dy: 0, dir: 'left'}
            ].filter(dir => {
                const x = head.x + dir.dx;
                const y = head.y + dir.dy;
                return x < 0 || x >= gridSize || y < 0 || y >= gridSize;
            });
            if (escapeDirs.length > 0) {
                const bestEscapeDir = escapeDirs[Math.floor(Math.random() * escapeDirs.length)];
                setNextDirection(bestEscapeDir.dir);
                return;
            }
        }
        
        // 紧急寻食优先（保留强化逻辑 + 安全性评估）
        if (isStarving && foods.length > 0) {
            const bestPath = findBestFood(head);
            // 检查路径安全性，即使在紧急情况下也要避免明显的危险
            if (bestPath.length > 0 && !isRiskyPath(bestPath, true, 5)) {
                setNextDirection(bestPath[0]);
                if (!validateDirection(nextDx, nextDy)) {
                    aiEscape();
                }
                return;
            }
            // 如果最佳路径不安全，尝试寻找替代路径
            const alternativePaths = [];
            const directions = [
                {dx: 0, dy: -1, dir: 'up'},
                {dx: 1, dy: 0, dir: 'right'},
                {dx: 0, dy: 1, dir: 'down'},
                {dx: -1, dy: 0, dir: 'left'}
            ];
            
            for (const dir of directions) {
                const nx = (head.x + dir.dx + gridSize) % gridSize;
                const ny = (head.y + dir.dy + gridSize) % gridSize;
                if (isSafe(nx, ny)) {
                    const pathToNearestFood = aStarPath({x: nx, y: ny}, foods[0]);
                    if (pathToNearestFood.length > 0) {
                        alternativePaths.push({dir: dir.dir, path: [dir.dir, ...pathToNearestFood]});
                    }
                }
            }
            
            // 选择最安全的替代路径
            const safeAlternative = alternativePaths.find(p => !isRiskyPath(p.path, true, 5));
            if (safeAlternative) {
                setNextDirection(safeAlternative.dir);
                return;
            }
        }
        
        // 循环检测
        if (isInLoop()) {
            aiEscape();
            return;
        }
        
        // 正常决策（原始A*逻辑 + 多步预测）
        let bestPath = findBestFood(head);
        if (bestPath.length === 0) {
            bestPath = findExplorationPath(head);
        }
        
        // 使用多步预测评估路径安全性
        const futureState = predictFutureState(bestPath, 5); // 预测5步后的状态
        const isPathSafe = !isRiskyPath(bestPath, false, 15) && 
                          !isInClosedLoop(futureState.snake[0], futureState.snake);
        
        if (bestPath.length > 0 && (isPathSafe || 
            (isCrazyMode && !isRiskyPath(bestPath, false, 10)))) {
            setNextDirection(bestPath[0]);
            if (!validateDirection(nextDx, nextDy)) {
                aiEscape();
                return;
            }
            if (snakeLength > 5) {
                // 检查路径是否包含穿墙移动
                let x = head.x, y = head.y;
                let hasWallThrough = false;
                
                for (let i = 0; i < Math.min(bestPath.length, 5); i++) { // 只检查前5步
                    switch (bestPath[i]) {
                        case 'up': y--; break;
                        case 'down': y++; break;
                        case 'left': x--; break;
                        case 'right': x++; break;
                    }
                    
                    // 检查是否穿墙
                    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) {
                        hasWallThrough = true;
                        break;
                    }
                }
                // 计算到最近食物的原始路径
                const nearestFood = foods.length > 0 ? 
                    foods.reduce((a, b) => getWrappedDistance(head, a) < getWrappedDistance(head, b) ? a : b) : 
                    {x: Math.floor(gridSize/2), y: Math.floor(gridSize/2)};
                const originalPath = aStarPath(head, nearestFood, false);
                const originalHasCollision = isRiskyPath(originalPath, true);
                const successRate = hasWallThrough ? (originalHasCollision ? 1.5 : 1.2) : 1.0;
                safePathPatterns.push([bestPath[0], successRate]);
                if (safePathPatterns.length > 15) {
                    safePathPatterns.sort((a, b) => b[1] - a[1]).slice(0, 15);
                }
            }
        } else {
            aiEscape();
        }
    }
    
    /** 设置蛇的下一个移动方向 */
    function setNextDirection(dir) {
        switch(dir) {
            case 'up': if (dy === 0) { nextDx = 0; nextDy = -1; } break;
            case 'down': if (dy === 0) { nextDx = 0; nextDy = 1; } break;
            case 'left': if (dx === 0) { nextDx = -1; nextDy = 0; } break;
            case 'right': if (dx === 0) { nextDx = 1; nextDy = 0; } break;
            case ' ': 
                // 只有当焦点不在其他可输入元素上时才触发暂停/继续游戏
                if (document.activeElement.tagName !== 'BUTTON' && 
                    document.activeElement.tagName !== 'INPUT' && 
                    document.activeElement.tagName !== 'TEXTAREA') {
                    if (gameRunning) {
                        pauseGame();
                    } else {
                        if (gameInitialized) {
                            resumeGame();
                        } else {
                            startGame();
                        }
                    }
                }
                break;
        }
    }
    
    /** 生成食物 */
    function generateFood() {
        let foodCount;
        if (difficulty === 4) {
            foodCount = score >= 5000 ? 10 : score >= 2500 ? 8 : score >= 1000 ? 6 : 4;
        } else {
            foodCount = difficulty;
        }
        
        foods = [];
        const safePositions = [];
        const isWallThrough = gameMode === 'wallThrough';
        
        for (let x = 0; x < gridSize; x++) {
            for (let y = 0; y < gridSize; y++) {
                const isBodyOccupied = snake.some(s => s.x === x && s.y === y);
                const isRecentBody = snake.slice(-5).some(s => s.x === x && s.y === y);
                if (isSafe(x, y, true) && !dangerousPositions.has(`${x},${y}`) && !isBodyOccupied && !isRecentBody) {
                    const isEdge = x < 4 || x >= gridSize - 4 || y < 4 || y >= gridSize - 4;
                    const edgeBonus = isWallThrough && isEdge ? 3 : 1;
                    for (let i = 0; i < edgeBonus; i++) {
                        safePositions.push({x, y});
                    }
                }
            }
        }
        
        const minDistance = difficulty === 4 ? 5 : 3;
        while (foods.length < foodCount && safePositions.length > 0) {
            const idx = Math.floor(Math.random() * safePositions.length);
            const newFood = safePositions.splice(idx, 1)[0];
            if (foods.every(f => Math.hypot(f.x - newFood.x, f.y - newFood.y) > minDistance)) {
                foods.push(newFood);
            }
        }
        
        while (foods.length < foodCount) {
            const newFood = {
                x: Math.floor(Math.random() * gridSize),
                y: Math.floor(Math.random() * gridSize)
            };
            if (!snake.some(s => s.x === newFood.x && s.y === newFood.y) &&
                !foods.some(f => f.x === newFood.x && f.y === newFood.y) &&
                foods.every(f => Math.hypot(f.x - newFood.x, f.y - newFood.y) > minDistance)) {
                foods.push(newFood);
            }
        }
    }
    
    /** 移动蛇 */
    function moveSnake() {
        dx = nextDx;
        dy = nextDy;
        let headX = snake[0].x + dx;
        let headY = snake[0].y + dy;
        
        if (gameMode === 'wallThrough') {
            headX = (headX + gridSize) % gridSize;
            headY = (headY + gridSize) % gridSize;
        }
        
        const head = {x: headX, y: headY};
        const prevDir = dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up';
        
        snake.unshift(head);
        
        const foodIndex = foods.findIndex(f => f.x === head.x && f.y === head.y);
        if (foodIndex !== -1) {
            score += 10 * difficulty;
            foods.splice(foodIndex, 1);
            lastFoodTime = Date.now(); // 重置紧急寻食计时
            positionHistory.length = 0;
            updateSafePatterns(prevDir, true);
            if (foods.length === 0) generateFood();
        } else {
            snake.pop();
            updateSafePatterns(prevDir, false);
        }
    }
    
    /** 更新安全路径模式库 */
    function updateSafePatterns(dir, isSuccess) {
        const existing = safePathPatterns.find(p => p[0] === dir);
        if (existing) {
            existing[1] = (existing[1] * 3 + (isSuccess ? 1 : 0.5)) / 4;
        } else {
            safePathPatterns.push([dir, isSuccess ? 1.0 : 0.5]);
        }
        
        // 限制模式库大小，保留成功率最高的模式
        if (safePathPatterns.length > 20) {
            safePathPatterns.sort((a, b) => b[1] - a[1]);
            safePathPatterns.splice(15); // 只保留前15个最成功的模式
        }
    }
    
    /** 检测碰撞（移除紧急寻食超时判定） */
    function checkCollision() {
        const head = snake[0];
        
        // 自撞检测
        for (let i = 1; i < snake.length; i++) {
            if (head.x === snake[i].x && head.y === snake[i].y) {
                dangerousPositions.add(`${head.x},${head.y}`);
                trimDangerousPositions();
                return true;
            }
        }
        
        // 边界碰撞检测
        if (gameMode === 'normal') {
            if (head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize) {
                dangerousPositions.add(`${head.x},${head.y}`);
                trimDangerousPositions();
                return true;
            }
        }
        
        return false;
    }
    
    /** 限制危险位置记录数量 */
    function trimDangerousPositions() {
        if (dangerousPositions.size > MAX_DANGEROUS_RECORDS) {
            const keys = Array.from(dangerousPositions);
            const excess = dangerousPositions.size - MAX_DANGEROUS_RECORDS;
            for (let i = 0; i < excess; i++) {
                dangerousPositions.delete(keys[i]);
            }
        }
    }
    
    /** 游戏主循环 */
    function gameLoop() {
        if (aiMode && gameRunning) {
            // 使用更严格的条件来触发紧急逃生
            if (countFreeSpace(snake[0], snake, 4) < 6 || 
                (Date.now() - lastFoodTime > FORCE_FOOD_TIMEOUT * 0.8 && getNearestFoodDistance() > 10)) {
                aiEscape();
            } else {
                aiMakeDecision();
            }
        }
        moveSnake();
        if (checkCollision()) {
            gameOver();
            return;
        }
        draw();
    }
    
    /** 游戏结束处理（显示紧急寻食失败原因） */
    function gameOver() {
        clearInterval(gameLoopId);
        gameRunning = false;
        startBtn.textContent = '重新开始';
        const lastDir = dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up';
        updateSafePatterns(lastDir, false);
        
        // 停止计时器
        stopTimer();
        
        const deathReason = '碰撞死亡';
        
        const gameOverDiv = document.createElement('div');
        gameOverDiv.style.position = 'fixed';
        gameOverDiv.style.top = '50%';
        gameOverDiv.style.left = '50%';
        gameOverDiv.style.transform = 'translate(-50%, -50%)';
        gameOverDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        gameOverDiv.style.padding = '30px';
        gameOverDiv.style.borderRadius = '10px';
        gameOverDiv.style.color = 'white';
        gameOverDiv.style.textAlign = 'center';
        gameOverDiv.style.zIndex = '1000';
        gameOverDiv.style.width = '300px';
        
        gameOverDiv.innerHTML = `
            <h2 style='margin-top: 0; color: #e74c3c;'>游戏结束！</h2>
            <p style='font-size: 18px;'>最终得分: <span style='color: #f1c40f; font-weight: bold;'>${score}</span></p>
            <p>死亡原因: ${deathReason}</p>
            <p>难度: ${['简单', '中等', '困难', '疯狂'][difficulty - 1]}</p>
            <p>模式: ${gameMode === 'normal' ? '普通模式' : '穿墙模式'}</p>
            <p>游戏时间: ${document.getElementById('timer').textContent}</p>
            <button id='restart-btn' style='margin-top: 20px; padding: 10px 20px; background-color: #2ecc71; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px;'>重新开始</button>
        `;
        
        document.body.appendChild(gameOverDiv);
        document.getElementById('restart-btn').addEventListener('click', () => {
            document.body.removeChild(gameOverDiv);
            startGame();
        });
    }
    
    /** 开始/继续游戏 */
    function resumeGame() {
        let baseSpeed = getBaseSpeed();
        
        let speed = gameMode === 'wallThrough' ? Math.max(20, baseSpeed * 0.7) : baseSpeed;
        if (aiMode) {
            speed = Math.max(10, speed * 0.8);
        }
        
        // 紧急寻食时提速
        if (Date.now() - lastFoodTime > FORCE_FOOD_TIMEOUT) {
            speed = Math.max(10, speed * 0.8);
        }
        
        gameRunning = true;
        startBtn.textContent = '暂停';
        if (gameLoopId) clearInterval(gameLoopId);
        gameLoopId = setInterval(gameLoop, speed);
        
        // 开始计时器
        startTimer();
    }
    
    /** 暂停游戏 */
    function pauseGame() {
        clearInterval(gameLoopId);
        gameRunning = false;
        startBtn.textContent = '继续';
        
        // 停止计时器
        stopTimer();
    }
    
    // 移动端控制
    document.querySelectorAll('.control-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (!gameRunning) return;
            switch(e.target.classList[1]) {
                case 'up': if (dy === 0) { nextDx = 0; nextDy = -1; } break;
                case 'down': if (dy === 0) { nextDx = 0; nextDy = 1; } break;
                case 'left': if (dx === 0) { nextDx = -1; nextDy = 0; } break;
                case 'right': if (dx === 0) { nextDx = 1; nextDy = 0; } break;
            }
        });
    });
    
    // 键盘控制
    document.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
        }
        switch(e.key) {
            case 'ArrowUp': if (dy === 0) { nextDx = 0; nextDy = -1; } break;
            case 'ArrowDown': if (dy === 0) { nextDx = 0; nextDy = 1; } break;
            case 'ArrowLeft': if (dx === 0) { nextDx = -1; nextDy = 0; } break;
            case 'ArrowRight': if (dx === 0) { nextDx = 1; nextDy = 0; } break;
            case ' ': 
                // 只有当焦点不在其他可输入元素上时才触发暂停/继续游戏
                if (document.activeElement.tagName !== 'BUTTON' && 
                    document.activeElement.tagName !== 'INPUT' && 
                    document.activeElement.tagName !== 'TEXTAREA') {
                    gameRunning ? pauseGame() : startGame();
                }
                break;
        }
    });
    
    // 难度选择
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!gameRunning) {
                difficulty = parseInt(btn.dataset.level);
                document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }
        });
    });
    document.querySelector('.difficulty-btn[data-level="1"]').classList.add('active');
    
    // 模式选择
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!gameRunning) {
                gameMode = btn.dataset.mode;
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }
        });
    });
    document.querySelector('.mode-btn[data-mode="normal"]').classList.add('active');
    
    // 创建AI按钮
    aiBtn = document.createElement('button');
    aiBtn.id = 'ai-btn';
    aiBtn.textContent = 'AI开始';
    aiBtn.style.marginLeft = '10px';
    aiBtn.style.padding = '8px 16px';
    aiBtn.style.backgroundColor = '#9b59b6';
    aiBtn.style.color = 'white';
    aiBtn.style.border = 'none';
    aiBtn.style.borderRadius = '4px';
    aiBtn.style.cursor = 'pointer';
    aiBtn.style.transition = 'background-color 0.3s';
    document.querySelector('.game-info').appendChild(aiBtn);
    
    aiBtn.addEventListener('click', () => {
        console.log('AI button clicked, aiMode before:', aiMode);
        aiMode = !aiMode;
        aiBtn.textContent = aiMode ? 'AI停止' : 'AI开始';
        aiBtn.style.backgroundColor = aiMode ? '#e74c3c' : '#9b59b6';
        console.log('AI button clicked, aiMode after:', aiMode);
    });
    
    // 添加调试日志以确认AI按钮事件监听器是否正常工作
    console.log('AI button created');
    
    // 速度控制
    const speedSlider = document.getElementById('speed-slider');
    const speedValue = document.getElementById('speed-value');
    
    speedSlider.addEventListener('input', () => {
        gameSpeed = parseInt(speedSlider.value);
        speedValue.textContent = gameSpeed;
        
        // 如果游戏正在运行，重新设置游戏循环间隔
        if (gameRunning) {
            clearInterval(gameLoopId);
            gameLoopId = setInterval(gameLoop, getBaseSpeed());
        }
    });
    
    startBtn.addEventListener('click', () => {
        // 添加调试日志
        console.log('Start button clicked');
        console.log('gameRunning:', gameRunning);
        console.log('gameInitialized:', gameInitialized);
        
        if (gameRunning) {
            console.log('Pausing game');
            pauseGame();
        } else {
            if (gameInitialized) {
                console.log('Resuming game');
                resumeGame();
            } else {
                console.log('Starting new game');
                startGame(); // 开始新游戏
            }
        }
    });
    
    draw();
    
    /** 开始游戏 */
    function startGame() {
        snake = [{x: 10, y: 10}];
        dx = 1;
        dy = 0;
        nextDx = 1;
        nextDy = 0;
        score = 0;
        lastFoodTime = Date.now();
        positionHistory.length = 0;
        
        let baseSpeed = getBaseSpeed();
        
        let speed = gameMode === 'wallThrough' ? Math.max(20, baseSpeed * 0.7) : baseSpeed;
        if (aiMode) {
            speed = Math.max(10, speed * 0.8);
        }
        
        generateFood();
        gameRunning = true;
        gameInitialized = true;
        startBtn.textContent = '暂停';
        if (gameLoopId) clearInterval(gameLoopId);
        gameLoopId = setInterval(gameLoop, speed);
        
        // 重置并开始计时器
        resetTimer();
        startTimer();
    }
    
    // 玩法说明弹窗功能
    // 创建玩法说明弹窗
    const modal = document.createElement('div');
    modal.id = 'instructions-modal';
    modal.className = 'modal';
    
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close">&times;</span>
            <h2>玩法说明</h2>
            <p>使用方向键或屏幕上的按钮控制蛇的移动方向。</p>
            <p>吃到食物后蛇身会变长，得分会增加。</p>
            <p>避免撞到墙壁或蛇自己的身体。</p>
            <p>在穿墙模式下，蛇可以穿过墙壁从另一边出现。</p>
            <p>通过难度选择可以调整游戏速度，疯狂模式具有最高速度。</p>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 获取弹窗元素和关闭按钮
    const instructionsBtn = document.getElementById('instructions-btn');
    const closeBtn = modal.querySelector('.close');
    
    // 显示弹窗
    instructionsBtn.addEventListener('click', () => {
        modal.style.display = 'block';
    });
    
    // 关闭弹窗
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    // 点击弹窗外部关闭
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    /** 更新计时器显示 */
    function updateTimerDisplay() {
        const timerElement = document.getElementById('timer');
        if (timerElement) {
            const totalSeconds = Math.floor(elapsedTime / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }
    
    /** 开始计时器 */
    function startTimer() {
        startTime = Date.now() - elapsedTime; // 保持已过时间
        timerInterval = setInterval(() => {
            elapsedTime = Date.now() - startTime;
            updateTimerDisplay();
        }, 100); // 每100毫秒更新一次显示
    }
    
    /** 停止计时器 */
    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }
    
    /** 重置计时器 */
    function resetTimer() {
        stopTimer();
        elapsedTime = 0;
        updateTimerDisplay();
    }
});

// 检查DOMContentLoaded事件处理程序是否正确执行
console.log('DOM fully loaded and parsed');
