/**   ,---,.                                  ,--,                                                   ___
    ,'  .'  \                               ,--.'|                                         .--.,   ,--.'|_   
    ,---.' .' |   ,---.                       |  | :                      __  ,-.          ,--.'  \  |  | :,'  
    |   |  |: |  '   ,'\ ,--,  ,--,           :  : '                    ,' ,'/ /|          |  | /\/  :  : ' :  
    :   :  :  / /   /   ||'. \/ .`|    ,---.  |  ' |              ,---. '  | |' | ,--.--.  :  : :  .;__,'  /   
    :   |    ; .   ; ,. :'  \/  / ;   /     \ '  | |             /     \|  |   ,'/       \ :  | |-,|  |   |    
    |   :     \'   | |: : \  \.' /   /    /  ||  | :            /    / ''  :  / .--.  .-. ||  : :/|:__,'| :    
    |   |   . |'   | .; :  \  ;  ;  .    ' / |'  : |__         .    ' / |  | '   \__\/: . .|  |  .'  '  : |__  
    '   :  '; ||   :    | / \  \  \ '   ;   /||  | '.'|        '   ; :__;  : |   ," .--.; |'  : '    |  | '.'| 
    |   |  | ;  \   \  /./__;   ;  \'   |  / |;  :    ;        '   | '.'|  , ;  /  /  ,.  ||  | |    ;  :    ; 
    |   :   /    `----' |   :/\  \ ;|   :    ||  ,   /         |   :    :---'  ;  :   .'   \  : \    |  ,   /  
    |   | ,'            `---'  `--`  \   \  /  ---`-'           \   \  /       |  ,     .-./  |,'     ---`-'   
    `----'                            `----'                     `----'         `--`---'   `--'                
    Github Url: https://github.com/HeronErin/true-3d
    Copyright (C) 2024 - HeronErin

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

// Constants:
const FOV = 0.5;

const renderDistance = 4; // MUST BE DIVISABLE BY 2

const renderDistanceHalf = Math.idiv(renderDistance, 2);
const TRI_MIN_DISTANCE = 20
const SQUARED_MIN = Math.pow(TRI_MIN_DISTANCE, 2);

const CHUNK_SIZE = 8

const QUICK_ACTION_TIME = 125


const CANNONIZE_FACTOR = 2000
const PHASH_FACTOR = CANNONIZE_FACTOR*500;
const CHUNK_CANNONIZE_FACTOR = Math.idiv(CANNONIZE_FACTOR, CHUNK_SIZE);

game.stats = true;


const RED_BLOCK = 2;
const GREEN_BLOCK = 5;
const PURPLE_BLOCK = 8;
const YELLOW_BLOCK = 11;

// Player info globals
let player_x = 0;
let player_y = 0;
let player_z = 0;

let player_rx = 0;
let player_ry = 0;
let player_rz = 0;

let gameMode = 0;

let lookingAt: number[] = null;

let player_cx: number = null;
let player_cz: number = null;


let chunks: number[][][][][] = [];
let currentchunks: number[][] = [];

let last = game.runtime();
let deltatime: number;
let forceRebuildChunk = false;
let back = scene.backgroundImage();

// Turn a 3d point into a single number, a bad form of hashing.
// This way indexOf will work on these PHASHES
function PHASH(pos: number[]) {
    return pos[0] + pos[1] * PHASH_FACTOR + pos[2] * PHASH_FACTOR * PHASH_FACTOR;
}

// Mostly unused. These funcs were an attempt to get Negative numbers to work,
// but it is more trouble than it is worth. 
// But if I try to remove them I also run into issues...
function canonizePoint(x: number, y: number, z: number){
    if (0 > x) x = x + CANNONIZE_FACTOR;
    if (0 > y) y += CANNONIZE_FACTOR;
    if (0 > z) z = z + CANNONIZE_FACTOR;
    return [x, y ,z];
}
function canonizeChunk(cx : number, cz : number){
    if (0 > cx) cx = cx + CHUNK_CANNONIZE_FACTOR;
    if (0 > cz) cz = cz + CHUNK_CANNONIZE_FACTOR;
    return [cx, cz];
}


let width = scene.screenWidth();
let height = scene.screenHeight();
function projectPoint(x: number, y: number, z: number) {
    // Make play the orgin of the world
    x -= player_x;
    y -= player_y;
    z -= player_z;

    // See https://en.wikipedia.org/wiki/3D_projection
    // For prospective projection
    const cx = Math.cos(player_rx);
    const cy = Math.cos(player_ry);
    const cz = Math.cos(player_rz);

    let sx = Math.sin(player_rx);
    let sy = Math.sin(player_ry);
    const sz = Math.sin(player_rz);

    // Handles player rotation
    const temp = (cz * y - sz * x);
    const temp2 = (cy * z + sy * (sz * y + cz * x));
    const dz = cx * temp2 - sx * temp;

    // Prevent rendering strange bugs
    if (dz < 0)
        return null;

    const dx = cy * (sz * y + cz * x) - sy * z;
    const dy = sx * temp2 + cx * temp;


    // Just devide by z to make 2d. Then screen width and height to normalize points
    sx = dx / dz * width * FOV;
    sy = dy / dz * height * FOV;


    // Make center of screen orgin 
    sy = height / 2 - sy;
    sx += width / 2;

    return [sx, sy, dz, null]
}
// Used to scale up, and offset objects (mutate points)
function mutPoints(points: number[][], scale: number, offsetx: number, offsety: number, offsetz: number) {
    return points.map(
        (point) => [point[0] * scale + offsetx, point[1] * scale + offsety, point[2] * scale + offsetz]
    );
}
                                                                    // Same rotation format as player rotations
function rotatePointAroundPoint(point: number[], origin: number[], theta: number[]) {
    point[0] -= origin[0];
    point[1] -= origin[1];
    point[2] -= origin[2];

    let cx = Math.cos(theta[0]);
    let cy = Math.cos(theta[1]);
    let cz = Math.cos(theta[2]);

    let sx = Math.sin(theta[0]);
    let sy = Math.sin(theta[1]);
    let sz = Math.sin(theta[2]);

    // Modified version of player rotation.
    let dx = cy * (sz * point[1] + cz * point[0]) - sy * point[2];
    let dy = sx * (cy * point[2] + sy * (sz * point[1] + cz * point[0])) + cx * (cz * point[1] - sz * point[0]);
    let dz = cx * (cy * point[2] + sy * (sz * point[1] + cz * point[0])) - sx * (cz * point[1] - sz * point[0]);

    point[0] = dx + origin[0];
    point[1] = dy + origin[1];
    point[2] = dz + origin[2];
    return point;
}
function rotatePoints(points: number[][], origin: number[], theta: number[]) {
    return points.map(
        (point) => rotatePointAroundPoint(point.slice(), origin, theta)
    );
}
// 3d models:

let planePoints = [
    // x  y   z
    [0.5, 0, 0.5],  // 0
    [-0.5, 0, 0.5], // 1
    [-0.5, 0, -0.5],// 2
    [0.5, 0, -0.5] // 3
]
let planeLines = [
    // Index, index, color
    [0, 1, 3],
    [1, 2, 3],
    [2, 3, 3],
    [3, 0, 3],
]
let planeTris = [
    // Index, index, index, color
    [0, 1, 2, 4],
    [2, 3, 0, 5]
]
let cubePoints = [
    [0.5, -0.5, 0.5],  // 0
    [-0.5, -0.5, 0.5], // 1
    [-0.5, -0.5, -0.5],// 2
    [0.5, -0.5, -0.5], // 3

    [0.5, 0.5, 0.5],  // 4
    [-0.5, 0.5, 0.5], // 5
    [-0.5, 0.5, -0.5],// 6
    [0.5, 0.5, -0.5], // 7
]
let cubeLines = [
    [0, 1, 14],
    [1, 2, 14],
    [2, 3, 14],
    [3, 0, 14],

    [4, 5, 14],
    [5, 6, 14],
    [6, 7, 14],
    [7, 4, 14],

    [4, 0, 14],
    [5, 1, 14],
    [6, 2, 14],
    [7, 3, 14],

];
let cubeTris = [
    // Bottom
    [0, 1, 2, 1],
    [2, 3, 0, 1],
    // Top
    [4, 5, 6, 2],
    [6, 7, 4, 2],
    // +Z
    [0, 1, 4, 3],
    [4, 5, 1, 3],
    // -Z
    [2, 3, 6, 4],
    [6, 7, 3, 4],
    // +X
    [0, 3, 4, 5],
    [4, 7, 3, 5],
    // -X
    [1, 2, 5, 8],
    [5, 6, 2, 8],
]

// FancyUi (aka the block selection meny)

let temp = 0;
let fancyBackground : Image = null;

// Generate block models with some lighting to make it look better in block place menu
const F_RED = cubeTris.map((tri) => [tri[0], tri[1], tri[2], RED_BLOCK + Math.idiv(temp++, 2) % 2])
const F_GREEN = cubeTris.map((tri) => [tri[0], tri[1], tri[2], GREEN_BLOCK + Math.idiv(temp++, 2) % 2])
const F_PURPLE= cubeTris.map((tri) => [tri[0], tri[1], tri[2], PURPLE_BLOCK + Math.idiv(temp++, 2) % 2])
const F_YELLOW = cubeTris.map((tri) => [tri[0], tri[1], tri[2], YELLOW_BLOCK + Math.idiv(temp++, 2) % 2]);

let F_pressing = false;

const F_BLOCKS = [
    [F_GREEN,  [[GREEN_BLOCK, 6, 0,  6, 0]]], // Block model, block id, current pos, target pos (animation)
    [F_RED,    [[RED_BLOCK,   0, 7,  0, 7]]],
    [F_PURPLE, [[PURPLE_BLOCK,-6, 0, -6, 0]]],
    [F_YELLOW, [[YELLOW_BLOCK, 0, -7, 0, -7]]],
    [[
        [0, 2, 4, RED_BLOCK],
        [4, 6, 0, RED_BLOCK],
    ], [[0, 0, 0, 0, 0]]]
];

function creep(current: number, towards: number, increment: number) {
    if (current == towards) return current;
    if (current > towards) return Math.max(towards, current - increment);
    else return Math.min(towards, current + increment);
}
let F_released_B = false;
let F_released_A = false;
let F_press_time : number = null;

// Ran every update when gameMode == 1
function fancyUi(){
    if (fancyBackground == null){
        back.fillCircle(width / 2, height / 2, width / 4, 0);
        fancyBackground = back.clone();
        F_released_B = !controller.B.isPressed();
        F_released_A = !controller.A.isPressed();
        F_press_time = game.runtime();
    }
    
    back.copyFrom(fancyBackground);
    
    // Keep the blocks always rotating
    let rot = game.runtime() / 1000;
    
    F_BLOCKS.forEach((block)=>{
        menuTriStack(
            mutPoints(
                rotatePoints(cubePoints, [0, 0, 0], [rot, rot, 0]), 3, block[1][0][1], block[1][0][2], 30
            ), block[0], 5);
        // Steadly move blocks toward target pos at a constant rate
        block[1][0][1] = creep(block[1][0][1], block[1][0][3], deltatime * 10);
        block[1][0][2] = creep(block[1][0][2], block[1][0][4], deltatime * 10);
    });

    // We must make a copy of the array BEFORE we do anything to it,
    // so that we can rotate the elements to the right or left
    let old = F_BLOCKS.map((x)=>x[1][0].map((z)=>z));
    if (controller.left.isPressed() && !F_pressing){
        for (let i = 0; i < F_BLOCKS.length; i++){
            let l_i = (i + 1) % F_BLOCKS.length
            F_BLOCKS[i][1][0][3] = old[l_i][3];
            F_BLOCKS[i][1][0][4] = old[l_i][4];
        }
    }
    else if (controller.right.isPressed() && !F_pressing) {
        for (let i = 0; i < F_BLOCKS.length; i++) {
            let l_i = (i - 1 + F_BLOCKS.length) % F_BLOCKS.length
            F_BLOCKS[i][1][0][3] = old[l_i][3];
            F_BLOCKS[i][1][0][4] = old[l_i][4];
        }
    }

    
    if (F_released_B && controller.B.isPressed()){
        gameMode = 0;
        fancyBackground = null;
        return;
    }
    if ( // Place block when both A and B are pressed when opening the menu OR if A is pressed while in menu
        (F_released_B && F_released_A && game.runtime() - F_press_time < QUICK_ACTION_TIME) 
        ||(F_released_A && controller.A.isPressed())) {
        gameMode = 0;
        fancyBackground = null;
        forceRebuildChunk = true;
        chunks = [[], []];

        for (const block of F_BLOCKS){
            if (block[1][0][3] == 0 && block[1][0][4] == 0){
                let off = 0==block[1][0][0] ? 0 : 3;
                SetBlock(lookingAt[0 + off], lookingAt[1 + off], lookingAt[2 + off], block[1][0][0]);

                return;
            }
        }
        saveGame();
        
    }
    F_pressing = controller.left.isPressed() || controller.right.isPressed();
    F_released_B = !controller.B.isPressed();
    F_released_A = !controller.A.isPressed();

}

function squaredDistance(point: number[]) {
    return Math.pow(point[0] - player_x , 2) + Math.pow(point[1] - player_y, 2) + Math.pow(point[2] - player_z, 2);
}
function semiDistance(point: number[]) {
    return Math.abs(point[0] - player_x) + Math.abs(point[1] - player_y) + Math.abs(point[2] - player_z);
}
function isInBounds(point : number[]){
    return point[0] > 0 && point[1] > 0 && point[0] < width && point[1] < height;
};
// This is the delta required to move the player / raycast one unit forward. 
function getDir() {
    const dx = -Math.sin(-player_ry) * Math.cos(player_rx);
    const dy = -Math.sin(player_rx);
    const dz = Math.cos(-player_ry) * Math.cos(player_rx);

    return [dx, dy, dz];
}
// This is adapted from an old appLab, which was adapted from some old C code. 
// totally forget how this works, but is FAST
function raycast() {
    let lx, ly, lz;
    let x = player_x, y = (player_y), z = player_z;
    const dir = getDir();
    let stepX = dir[0] / Math.abs(dir[0]);
    let stepY = dir[1] / Math.abs(dir[1]);
    let stepZ = dir[2] / Math.abs(dir[2]);

    let tMaxX = (stepX > 0) ? ((Math.floor(x) + 1 - x) / dir[0]) : ((x - Math.floor(x)) / -dir[0]);
    let tMaxY = (stepY > 0) ? ((Math.floor(y) + 1 - y) / dir[1]) : ((y - Math.floor(y)) / -dir[1]);
    let tMaxZ = (stepZ > 0) ? ((Math.floor(z) + 1 - z) / dir[2]) : ((z - Math.floor(z)) / -dir[2]);

    let tDeltaX = Math.abs(1 / dir[0]);
    let tDeltaY = Math.abs(1 / dir[1]);
    let tDeltaZ = Math.abs(1 / dir[2]);

    let distanceTraveled = 0;

    while (distanceTraveled < 10) {
        lx = x; ly = y; lz = z;
        if (tMaxX < tMaxY) {
            if (tMaxX < tMaxZ) {
                x += stepX;
                tMaxX += tDeltaX;
            } else {
                z += stepZ;
                tMaxZ += tDeltaZ;
            }
        } else {
            if (tMaxY < tMaxZ) {
                y += stepY;
                tMaxY += tDeltaY;
            } else {
                z += stepZ;
                tMaxZ += tDeltaZ;
            }
        }

        // Check if the current position intersects with a block
        if (GetBlock(Math.floor(x), Math.floor(y), Math.floor(z))) {
            return [Math.floor(x), Math.floor(y), Math.floor(z), Math.floor(lx), Math.floor(ly), Math.floor(lz)];
        }

        distanceTraveled++;
    }

    return null;
}
// Most stripped down version of the 3d object render. All the math is here, take it in. 
// Points are relative to screen, not to player. This is best used in UI
function menuTriStack(points: number[][], tris: number[][], color : number){
    const pstack = points.map((xy)=>{
        let sx = xy[0] / xy[2] * width;
        let sy = xy[1] / xy[2] * height;

        sy = height / 2 - sy;
        sx += width / 2;
        return [sx, sy, xy[2]];
    });
    tris
        .map((tri) => [pstack[tri[0]], pstack[tri[1]], pstack[tri[2]], [tri[3]]])
        .sort((t1, t2) => (t1[0][2] + t1[1][2] + t1[2][2]) - (t2[0][2] + t2[1][2] + t2[2][2]))
       .forEach((x)=>{
           back.fillTriangle(x[0][0], x[0][1], x[1][0], x[1][1], x[2][0], x[2][1], x[3][0]);
       })
}
// Optimized triangle renderer. 
function drawTriStack(points: number[][], tris: number[][]) {
    // 2d point array
    const pstack: number[][] = [];
    // List of valid triangles
    let valid: number[][][] = [];
    // List of dephs used in ordering to triangles
    const deph: number[] = [];


    // Build of triangles, eliminate ones too far away, project them, and add to valid + delph arrays
    for (const tri of tris) {
        const p0 = tri[0];
        const p1 = tri[1];
        const p2 = tri[2];
        const point0 = points[p0];
        const point1 = points[p1];
        const point2 = points[p2];

        if ( // Test of too far away, should be quite fast
            semiDistance(point0) < TRI_MIN_DISTANCE &&
            semiDistance(point1) < TRI_MIN_DISTANCE &&
            semiDistance(point2) < TRI_MIN_DISTANCE
        ) {
            // Use pstack as a cache so we never need to projectPoint a point twice (in same frame)
            let temp0 = pstack[p0] || (pstack[p0] = projectPoint(point0[0], point0[1], point0[2]));
            let temp1 = pstack[p1] || (pstack[p1] = projectPoint(point1[0], point1[1], point1[2]));
            let temp2 = pstack[p2] || (pstack[p2] = projectPoint(point2[0], point2[1], point2[2]));

            if (temp0 && temp1 && temp2 && (isInBounds(temp0) || isInBounds(temp1) || isInBounds(temp2))) {
                valid.push([temp0, temp1, temp2, [tri[3]] ]);
                deph.push(temp0[2] + temp1[2] + temp2[2]);
            }
        }
    }

    // Sort valid triangles by depth (front to back)
    // Based on the wikipedia article for Selection Sort.
    // Simply put, the js sorting algorithm is too slow for this use case. 
    for (let i = 0; i < valid.length; i++) {
        let maxDepthIndex = i;
        for (let j = i + 1; j < valid.length; j++) {
            if (deph[j] > deph[maxDepthIndex]) {
                maxDepthIndex = j;
            }
        }
        [deph[i], deph[maxDepthIndex]] = [deph[maxDepthIndex], deph[i]];
        [valid[i], valid[maxDepthIndex]] = [valid[maxDepthIndex], valid[i]];
    }
    
    // Draw valid triangles
    for (const x of valid) {
        back.fillTriangle(x[0][0], x[0][1], x[1][0], x[1][1], x[2][0], x[2][1], x[3][0]);
    }

}
// Draw wireframe models, no sorting in needed, and it is only used in the cursor anyways.
function drawLineStack(points: number[][], lines: number[][]) {
    let pstack = points.map(
        (point) => projectPoint(point[0], point[1], point[2])
    );

    lines.forEach((point) => {
        let p1 = pstack[point[0]];
        let p2 = pstack[point[1]];

        if (p1 == null || p2 == null) return;

        if (p1[0] < 0 && p2[0] < 0) return;
        if (p1[1] < 0 && p2[1] < 0) return;
        if (p1[0] > width && p2[0] > width) return;
        if (p1[1] > height && p2[1] > height) return;

        // At this point we know at least one point is visable
        back.drawLine(p1[0], p1[1], p2[0], p2[1], point[2]);
    })
}
// Get from a list, and extend it if too small. Always give back an array
function extendAndGet(l: any[][], index: number) {
    while (l.length <= index)
        l.push([]);
    return l[index];
}
// ChunkX, ChunkZ, Y, X, Z, id
let world: number[][][][][] = [];


function SetBlock(x: number, y: number, z: number, id: number) {
    // Negative coords break the engine
    if (x < 0) return;
    if (y < 0) return;
    if (z < 0) return;
    let tpos = canonizePoint(x, y, z);
    let cx = Math.idiv(tpos[0], CHUNK_SIZE);
    let cz = Math.idiv(tpos[2], CHUNK_SIZE);

    let chunkRowX = extendAndGet(world, cx);
    let chunk = extendAndGet(chunkRowX, cz);
    let rowY = extendAndGet(chunk, y);
    let rowX = extendAndGet(rowY, tpos[0] % CHUNK_SIZE);
    while (rowX.length != CHUNK_SIZE)
        rowX.push(0);
    rowX[tpos[2] % CHUNK_SIZE] = id;
    
    
}
function GetBlock(x: number, y: number, z: number) {
    if (x < 0) return 0;
    if (y < 0) return 0;
    if (z < 0) return 0;
    let tpos = canonizePoint(x, y, z);
    let chunkRowX = world[Math.idiv(tpos[0], CHUNK_SIZE)];
    if (!chunkRowX || !chunkRowX.length) return 0;

    let chunk = chunkRowX[Math.idiv(tpos[2], CHUNK_SIZE)];
    if (!chunk || !chunk.length) return 0;

    let rowY = chunk[tpos[1]];
    if (!rowY || !rowY.length) return 0;

    let rowX = rowY[tpos[0] % CHUNK_SIZE];
    if (!rowX || !rowX.length) return 0;

    let b = rowX[tpos[2] % CHUNK_SIZE];
    return b ? b : 0;
}
// These are some magic numbers used in chunk model construction
const faces = [
    [4, .5, 0, 0],
    [5, -.5, 0, 0],
    [6, 0, .5, 0],
    [7, 0, -.5, 0],
    [8, 0, 0, .5],
    [9, 0, 0, -.5],
];

// Generate an optimized render stack for a single chunk.
function genChunkStack(cx: number, cz: number) {
    if (cx < 0) return [[], []];
    if (cz < 0) return [[], []];
    let cannon_chunk = canonizeChunk(cx, cz);

    let chunkRowX = extendAndGet(world, cannon_chunk[0]);
    let chunk = extendAndGet(chunkRowX, cannon_chunk[1]);
    if (!chunk.length) return [[], []];
    let truecx = cx * CHUNK_SIZE;
    let truecz = cz * CHUNK_SIZE;
    let blockStack: number[][] = [];

    let chunkRenderStack: number[][][] = [[], [], []];

    for (let y = 0; y < chunk.length; y++) {
        let rowy: number[][] = chunk[y];
        for (let x = 0; x < rowy.length; x++) {
            let rowx: number[] = rowy[x];
            for (let z = 0; z < rowx.length; z++) {
                if (rowx[z])
                    blockStack.push(
                        [
                            x + truecx, y, z + truecz, rowx[z],
                            GetBlock(x + 1 + truecx, y, z + truecz), GetBlock(x + truecx - 1, y, z + truecz),
                            GetBlock(x + truecx, y + 1, z + truecz), GetBlock(x + truecx, y - 1, z + truecz),
                            GetBlock(x + truecx, y, z + 1 + truecz), GetBlock(x + truecx, y, z + truecz - 1)]
                    );
            }
        }
    }
    for (let block of blockStack) {
        let offset = chunkRenderStack[0].length;
        let facePoints: number[][] = [];
        let faceTrigs: number[][] = [];
        let faceLines: number[][] = [];
        let phashes: number[] = [];
        faces.forEach((face) => {
            if (0 != block[face[0]]) return;  // Skip convered sides

            let points = [
                [.5, .5],
                [-.5, .5],
                [-.5, -.5],
                [.5, -.5],
            ].map((pm) => {
                return [(face[1] ? face[1] : pm.pop()) + block[0], (face[2] ? face[2] : pm.pop()) + block[1], (face[3] ? face[3] : pm.pop()) + block[2]]
            });

            let pdex = points.map((p) => {
                let ph = PHASH(p);
                let i = phashes.indexOf(ph);
                if (i == -1) {
                    i = phashes.length;
                    phashes.push(ph);
                    facePoints.push(p);
                }
                return i + offset;
            });

            faceTrigs.push([pdex[0], pdex[1], pdex[2], block[3], block[3]]);
            faceTrigs.push([pdex[2], pdex[3], pdex[0], block[3], block[3]]);
            // faceLines.push([pdex[0], pdex[3], block[3]]);
            // faceLines.push([pdex[1], pdex[2], block[3]]);
            // faceLines.push([pdex[2], pdex[3], block[3]]);
            // faceLines.push([pdex[3], pdex[0], block[3]]);
            // faceLines.push([pdex[3], pdex[4], block[3]])
            ;
        });
        chunkRenderStack[0] = chunkRenderStack[0].concat(facePoints);
        chunkRenderStack[1] = chunkRenderStack[1].concat(faceTrigs);
        chunkRenderStack[2] = chunkRenderStack[2].concat(faceLines);

    }

    return chunkRenderStack;
}
// Modify the chunk 3d models directly to avoid frequent reconstruction
function updateLighting(){
    // return;
    for (let i = 0; i < currentchunks.length; i++){
        const xy = canonizeChunk(currentchunks[i][0], currentchunks[i][1]);
        if (xy[0] >= chunks.length) continue;
        const row = chunks[xy[0]];
        if (xy[1] >= row.length) continue;
        const chunk = row[xy[1]];
        if (!chunk.length) continue;
        const cposes = chunk[0];

        chunk[1] = chunk[1].map((tri) => {
            let meanDistance = Math.idiv(
                squaredDistance(cposes[tri[0]])
                + squaredDistance(cposes[tri[1]])
                + squaredDistance(cposes[tri[2]]), 3);
            tri[3] = tri[4];

            // if (meanDistance > 0.2)
            // tri[3]+=1;
            // tri[3] += 2;
            if (meanDistance > 10)
                tri[3] += 1;
            if (meanDistance > 40)
                tri[3] += 1;
            // if (meanDistance > 4)
            //     tri[3] += 1;

            return tri;
        })
    }


}

function saveGame(){
    const playerJson = JSON.stringify({
        "x": player_x,
        "y": player_y,
        "z": player_z,
        "rx": player_rx,
        "ry": player_ry,
        "rz": player_rz,
        "CHUNK_SIZE": CHUNK_SIZE
    });
    const worldJson = JSON.stringify(world);

    blockSettings.writeString("player", playerJson);
    blockSettings.writeString("world", worldJson);
}
function loadGame(){
    let playerJson = blockSettings.readString("player");
    let worldJson = blockSettings.readString("world");
    if (playerJson == undefined || worldJson == undefined)
        return false;
    
    let playerObj = JSON.parse(playerJson);
    if (playerObj.CHUNK_SIZE != CHUNK_SIZE){
        let a = game.ask("Chunck size error!!", "Want to clear the game?");
        if (!a){
            game.gameOver(false);
            return true;
        }
        return false;
    }

    world = JSON.parse(worldJson);

    player_x = playerObj.x;
    player_y = playerObj.y;
    player_z = playerObj.z;

    player_rx = playerObj.rx;
    player_ry = playerObj.ry;
    player_rz = playerObj.rz;

    return true;

}

if (!loadGame()){
    for (let x = 1; x++ < 25;) {
        for (let z = 1; z++ < 25;) {
            SetBlock(x, 2, z, GREEN_BLOCK);
            SetBlock(x, 1, z, PURPLE_BLOCK);
            SetBlock(x, 0, z, PURPLE_BLOCK);
        }
    }
}

// Main loop
game.onUpdate(() => {
    let r = game.runtime();
    deltatime = (r - last) / 1000;
    last = r;
    if (gameMode == 1) return fancyUi();
    back.fill(0);
    let tcx = Math.round(player_x / CHUNK_SIZE);
    let tcz = Math.round(player_z / CHUNK_SIZE);
    
    if (player_cx != tcx || player_cz != tcz || forceRebuildChunk){
        forceRebuildChunk = false;
        player_cx = tcx;
        player_cz = tcz;
        currentchunks = [];
        // if (renderDistance == 1)
            // genChunkStack(Math.idiv(player_x, CHUNK_SIZE), Math.idiv(player_z, CHUNK_SIZE));
        for (let cx = tcx - renderDistanceHalf; cx < tcx + renderDistanceHalf; cx++){
            for (let cz = tcz - renderDistanceHalf; cz < tcz + renderDistanceHalf; cz++){
                // if (cx > 100) continue;
                // if (cz > 100) continue;
                const cannon_chunk = canonizeChunk(cx, cz);

                const rowx = extendAndGet(chunks, cannon_chunk[0]);
                let chunk = extendAndGet(rowx, cannon_chunk[1]);

                if (chunk.length == 0)
                    chunks[cannon_chunk[0]][cannon_chunk[1]] = chunk = genChunkStack(cx, cz);
                    
                if (chunk.length)
                    currentchunks.push([cx, cz]);
                // let chunk = genChunkStack(cx, cz)
                if (chunk && chunk.length)
                    chunks[cannon_chunk[0]][cannon_chunk[1]] = chunk;
                    
                
            }
        }

        saveGame();
        
        
    }
    updateLighting();
    const c_true_x = player_x / CHUNK_SIZE;
    const c_true_z = player_z / CHUNK_SIZE;
    

    currentchunks
        // Render far away chunks first, then the ones closer to the player.
        // Sorting a few dozen chunks is faster than tens of thousands of triangles. 
        .sort((xy, xy2) => {
            const dx = Math.max(
                Math.pow(c_true_x - xy[0], 2),
                Math.pow(c_true_x - (xy[0] + .999), 2)
            );
            const dz = Math.max(
                Math.pow(c_true_z - xy[1], 2),
                Math.pow(c_true_z - (xy[1] + .999), 2)
            );
            const dx2 = Math.max(
                Math.pow(c_true_x - xy2[0], 2),
                Math.pow(c_true_x - (xy2[0] + .999), 2)
            );
            const dz2 = Math.max(
                Math.pow(c_true_z - xy2[1], 2),
                Math.pow(c_true_z - (xy2[1] + .999), 2)
            );
            return (dx2 + dz2) - (dx + dz);
        })
        .forEach((xy) => {
            const cannon_chunk = canonizeChunk(xy[0], xy[1])
            const chunk = chunks[cannon_chunk[0]][cannon_chunk[1]];
            drawTriStack(chunk[0], chunk[1]);
        });

    
    lookingAt = raycast();
    if (null != lookingAt && lookingAt[3] >= 0 && lookingAt[4] >= 0 && lookingAt[5] >= 0) {
        const scalar = 1 + Math.sin(r / 100) / 9;
        const outLinePoints = mutPoints(cubePoints, scalar, lookingAt[0], lookingAt[1], lookingAt[2]);
        const dirx = -.5 * Math.sign(lookingAt[0] - lookingAt[3]);
        const diry = .5 * -Math.sign(lookingAt[1] - lookingAt[4]);
        const dirz = .5 * -Math.sign(lookingAt[2] - lookingAt[5]);
        
        temp = 0;
        let previewPoints: number[][] = mutPoints(cubePoints.filter((xy)=>{
            if (dirx)
                return dirx == xy[0];
            if (diry)
                return diry == xy[1];
            if (dirz)
                return dirz == xy[2];
            return true;
        }), scalar, lookingAt[0], lookingAt[1], lookingAt[2]).map((xy) => projectPoint(xy[0], xy[1], xy[2]));
        
        drawLineStack(outLinePoints, cubeLines);
        if (-1 == previewPoints.indexOf(null))
            back.fillPolygon4(
                previewPoints[0][0],
                previewPoints[0][1],
                previewPoints[1][0],
                previewPoints[1][1],
                previewPoints[2][0],
                previewPoints[2][1],
                previewPoints[3][0],
                previewPoints[3][1],
                1
            );


    }
    

    if (controller.left.isPressed()) player_ry -= deltatime;
    if (controller.right.isPressed()) player_ry += deltatime;

    if (controller.up.isPressed()) player_rx -= deltatime;
    if (controller.down.isPressed()) player_rx += deltatime;

    let forward = 0;
    if (controller.A.isPressed()) forward += deltatime * 4;
    if (controller.B.isPressed()) forward -= deltatime * 4;
    if (controller.A.isPressed() && controller.B.isPressed() && lookingAt) gameMode = 1;

    player_x += -forward * Math.sin(-player_ry) * Math.cos(player_rx);
    player_y -= forward * Math.sin(player_rx);
    player_z += forward * Math.cos(-player_ry) * Math.cos(player_rx);
});

