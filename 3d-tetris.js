let gl;
let shaderProgram;
let programInfo;
let buffers;
let isPaused = false;
let lastUpdateTime = 0;
let gravityInterval = 500; // Gravity interval in milliseconds
let lastGravityTime = 0;
const gridWidth = 4;
const gridDepth = 4;
const gridHeight = 10;
const activePieces = [];

const pieces = [
  [[[1, 1, 1, 1]], [[1], [1], [1], [1]], "cyan"],
  [[[1, 1, 1], [1, 0, 0]], [[1, 0, 0], [1, 1, 1]], [[0, 0, 1], [1, 1, 1]], [[1, 1, 1], [0, 0, 1]], "blue"],
  [[[0, 0, 1], [1, 1, 1]], [[1, 1], [0, 1], [0, 1]], [[1, 1, 1], [1, 0, 0]], [[1, 0], [1, 0], [1, 1]], "orange"],
  [[[1, 1], [1, 1]], "yellow"],
  [[[0, 1, 1], [1, 1, 0]], [[1, 0], [1, 1], [0, 1]], "green"],
  [[[1, 1, 1], [0, 1, 0]], [[0, 1], [1, 1], [0, 1]], [[0, 1, 0], [1, 1, 1]], [[1, 0], [1, 1], [1, 0]], "purple"],
  [[[1, 1, 0], [0, 1, 1]], [[0, 1], [1, 1], [1, 0]], "red"],
];

main();

function main() {
  const canvas = document.getElementById("glcanvas");
  gl = initWebGL(canvas);

  if (!gl) {
    return;
  }

  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clearDepth(1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);

  shaderProgram = initShaderProgram(gl, vsSource, fsSource);

  // Get the attribute and uniform locations
  programInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition"),
      vertexColor: gl.getAttribLocation(shaderProgram, "aVertexColor"),
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(shaderProgram, "uProjectionMatrix"),
      modelViewMatrix: gl.getUniformLocation(shaderProgram, "uModelViewMatrix"),
    },
  };

  buffers = initBuffers(gl);

  const grid = create3DGrid(gridWidth, gridDepth, gridHeight); // Updated grid to 4x4 walls and height of 10

  // Initialize the first piece and add it to the active pieces array
  addNewPiece(grid);

  function render(now) {
    now *= 0.001; // Convert to seconds
    const deltaTime = now - lastUpdateTime;
    lastUpdateTime = now;

    if (!isPaused) {
      // Gravity effect
      const currentTime = Date.now();
      if (currentTime - lastGravityTime >= gravityInterval) {
        lastGravityTime = currentTime;
        applyGravity(grid);
      }
    }

    drawScene(gl, programInfo, buffers, grid, activePieces);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  // Add event listener for keyboard inputs
  document.addEventListener("keydown", (event) => handleKeyDown(event, grid));
}

function handleKeyDown(event, grid) {
  const currentPiece = activePieces[activePieces.length - 1];
  switch (event.key) {
    case "ArrowRight":
    case "d":
      if (canMove(currentPiece, 1, 0, 0, grid)) currentPiece.position.x += 1;
      break;
    case "ArrowLeft":
    case "a":
      if (canMove(currentPiece, -1, 0, 0, grid)) currentPiece.position.x -= 1;
      break;
    case "ArrowUp":
    case "w":
      if (canMove(currentPiece, 0, 0, 1, grid)) currentPiece.position.z += 1;
      break;
    case "ArrowDown":
    case "s":
      if (canMove(currentPiece, 0, 0, -1, grid)) currentPiece.position.z -= 1;
      break;
    case "x":
      rotatePiece(currentPiece, 'x', -90, grid);
      break;
    case "X":
      rotatePiece(currentPiece, 'x', 90, grid);
      break;
    case "y":
      rotatePiece(currentPiece, 'y', -90, grid);
      break;
    case "Y":
      rotatePiece(currentPiece, 'y', 90, grid);
      break;
    case "z":
      rotatePiece(currentPiece, 'z', -90, grid);
      break;
    case "Z":
      rotatePiece(currentPiece, 'z', 90, grid);
      break;
    case "p":
      isPaused = !isPaused;
      break;
    case " ":
      releasePiece(grid);
      break;
  }
}

function applyGravity(grid) {
  const currentPiece = activePieces[activePieces.length - 1];
  if (canMove(currentPiece, 0, -1, 0, grid)) {
    currentPiece.position.y -= 1;
  } else {
    releasePiece(grid);
  }
}

function releasePiece(grid) {
  const currentPiece = activePieces[activePieces.length - 1];
  while (canMove(currentPiece, 0, -1, 0, grid)) {
    currentPiece.position.y -= 1;
  }
  placePieceInGrid(currentPiece, grid);
  checkAndRemoveFullSlices(grid);
  addNewPiece(grid);
}

function addNewPiece(grid) {
  const randomIndex = Math.floor(Math.random() * pieces.length);
  const newPiece = new Tetromino(pieces[randomIndex]);
  newPiece.position.y = gridHeight - 1; // Start the new piece at the top of the grid
  newPiece.position.z = Math.floor(gridDepth / 2); // Center the new piece on the z-axis
  console.log("This is the new piece from addNewPiece function", newPiece);
  activePieces.push(newPiece);
}

function rotatePiece(piece, axis, angle, grid) {
  const originalRotation = { ...piece.rotation };

  if (axis === 'x') piece.rotation.x += angle;
  if (axis === 'y') piece.rotation.y += angle;
  if (axis === 'z') piece.rotation.z += angle;

  if (!canMove(piece, 0, 0, 0, grid)) {
    piece.rotation = originalRotation;
  }
}

// This is the collision detection function
function canMove(piece, dx, dy, dz, grid) {
  const { shape, position, rotation } = piece;

  const tempPiece = new Tetromino(piece.shape);
  tempPiece.position = { x: position.x + dx, y: position.y + dy, z: position.z + dz };
  tempPiece.rotation = { x: rotation.x, y: rotation.y, z: rotation.z };

  console.log("From canMove function, the piece:", tempPiece);

  // Check if piece is within bounds and not colliding with other pieces
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (shape[y][x] !== 0) {
        const newX = x + tempPiece.position.x;
        const newY = y + tempPiece.position.y;
        const newZ = tempPiece.position.z;

        if (
          newX < 0 ||
          newX >= gridWidth ||
          newY < 0 ||
          newY >= gridHeight ||
          newZ < 0 ||
          newZ >= gridDepth ||
          grid[newX][newZ][newY] !== 0
        ) {
          console.log(`Collision detected: newX=${newX}, newY=${newY}, newZ=${newZ}`);
          return false;
        }
      }
    }
  }
  return true;
}

function placePieceInGrid(piece, grid) {
  const { shape, position } = piece;

  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (shape[y][x] !== 0) {
        const newX = x + position.x;
        const newY = y + position.y;
        const newZ = position.z;
        grid[newX][newZ][newY] = 1; // Mark the grid as occupied
      }
    }
  }
}

function checkAndRemoveFullSlices(grid) {
  for (let y = 0; y < gridHeight; y++) {
    let isFull = true;
    for (let x = 0; x < gridWidth; x++) {
      for (let z = 0; z < gridDepth; z++) {
        if (grid[x][z][y] === 0) {
          isFull = false;
          break;
        }
      }
      if (!isFull) break;
    }
    if (isFull) {
      removeSlice(grid, y);
      y--; // Recheck the current level after removal
    }
  }
}

function removeSlice(grid, y) {
  for (let x = 0; x < gridWidth; x++) {
    for (let z = 0; z < gridDepth; z++) {
      for (let yy = y; yy < gridHeight - 1; yy++) {
        grid[x][z][yy] = grid[x][z][yy + 1];
      }
      grid[x][z][gridHeight - 1] = 0;
    }
  }
}

function initBuffers(gl) {
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  const positions = [
    -0.5, -0.5, 0.0, 0.5, -0.5, 0.0, 0.5, 0.5, 0.0, -0.5, 0.5, 0.0,
  ];

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

  const indices = [0, 1, 1, 2, 2, 3, 3, 0];

  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array(indices),
    gl.STATIC_DRAW
  );

  const colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);

  const colors = [
    1.0,
    1.0,
    1.0,
    1.0, // white color for grid lines
    1.0,
    1.0,
    1.0,
    1.0,
    1.0,
    1.0,
    1.0,
    1.0,
    1.0,
    1.0,
    1.0,
    1.0,
  ];

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

  return {
    position: positionBuffer,
    indices: indexBuffer,
    color: colorBuffer,
    vertexCount: indices.length,
  };
}

function drawScene(gl, programInfo, buffers, grid, pieces) {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const fieldOfView = (45 * Math.PI) / 180;
  const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
  const zNear = 0.1;
  const zFar = 100.0;
  const projectionMatrix = mat4.create();

  mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

  const modelViewMatrix = mat4.create();
  const eye = vec3.fromValues(15.0, 10.0, 20.0); // Adjusted camera position
  const center = vec3.fromValues(0.0, 0.0, 0.0); // Look towards the origin
  const up = vec3.fromValues(0.0, 1.0, 0.0); // Up direction

  mat4.lookAt(modelViewMatrix, eye, center, up);
  // Scale the grid to enlarge it by 2 times
  mat4.scale(modelViewMatrix, modelViewMatrix, [1.5, 1.5, 1.5]);
  // Translate the grid downwards to center it
  mat4.translate(modelViewMatrix, modelViewMatrix, [0, -3, 0]);
  // Rotate the grid an additional 20 degrees clockwise
  mat4.rotateY(modelViewMatrix, modelViewMatrix, -Math.PI / 1.5);

  gl.useProgram(programInfo.program);

  gl.uniformMatrix4fv(
    programInfo.uniformLocations.projectionMatrix,
    false,
    projectionMatrix
  );

  drawGrid(gl, programInfo, buffers, modelViewMatrix, grid);

  for (const piece of pieces) {
    drawTetromino(gl, programInfo, buffers, modelViewMatrix, piece);
  }
}

function create3DGrid(width, depth, height) {
  const grid = new Array(width);
  for (let x = 0; x < width; x++) {
    grid[x] = new Array(depth);
    for (let z = 0; z < depth; z++) {
      grid[x][z] = new Array(height).fill(0);
    }
  }
  return grid;
}

function drawGrid(gl, programInfo, buffers, modelViewMatrix, grid) {
  const translateX = 2.5;
  const translateZ = 2.5;

  // Draw bottom floor
  for (let x = 0; x < grid.length; x++) {
    for (let z = 0; z < grid[x].length; z++) {
      const mvMatrixFloor = mat4.clone(modelViewMatrix);
      mat4.translate(mvMatrixFloor, mvMatrixFloor, [x - 2, -0.7, z - 2.3]);
      mat4.rotateX(mvMatrixFloor, mvMatrixFloor, -Math.PI / 2); // Rotate to make it horizontal

      gl.uniformMatrix4fv(
        programInfo.uniformLocations.modelViewMatrix,
        false,
        mvMatrixFloor
      );

      drawSquare(gl, programInfo, buffers, [1.0, 1.0, 1.0, 1.0]);
    }
  }

  // Draw left wall
  for (let z = 0; z < grid[0].length; z++) {
    for (let y = 0; y < grid[0][0].length; y++) {
      const mvMatrixLeft = mat4.clone(modelViewMatrix);
      mat4.translate(mvMatrixLeft, mvMatrixLeft, [
        -translateX + 0.2,
        y,
        z - translateZ,
      ]);
      mat4.rotateY(mvMatrixLeft, mvMatrixLeft, -Math.PI / 2); // Rotate to make it vertical

      gl.uniformMatrix4fv(
        programInfo.uniformLocations.modelViewMatrix,
        false,
        mvMatrixLeft
      );

      drawSquare(gl, programInfo, buffers, [1.0, 1.0, 1.0, 1.0]);
    }
  }

  // Draw right wall
  for (let x = 0; x < grid.length; x++) {
    for (let y = 0; y < grid[x][0].length; y++) {
      const mvMatrixRight = mat4.clone(modelViewMatrix);
      mat4.translate(mvMatrixRight, mvMatrixRight, [
        x - translateX,
        y - 1,
        translateZ,
      ]);

      gl.uniformMatrix4fv(
        programInfo.uniformLocations.modelViewMatrix,
        false,
        mvMatrixRight
      );

      drawSquare(gl, programInfo, buffers, [1.0, 1.0, 1.0, 1.0]);
    }
  }
}

function drawSquare(gl, programInfo, buffers, color) {
  const colors = new Float32Array([...color, ...color, ...color, ...color]);

  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
  gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
  gl.vertexAttribPointer(
    programInfo.attribLocations.vertexPosition,
    3, // 3D coordinates
    gl.FLOAT,
    false,
    0,
    0
  );
  gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
  gl.vertexAttribPointer(
    programInfo.attribLocations.vertexColor,
    4, // 4 values for RGBA
    gl.FLOAT,
    false,
    0,
    0
  );
  gl.enableVertexAttribArray(programInfo.attribLocations.vertexColor);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);

  const offset = 0;
  const vertexCount = buffers.vertexCount;
  const type = gl.UNSIGNED_SHORT;
  gl.drawElements(gl.LINES, vertexCount, type, offset);
}

function Tetromino(shape) {
  this.shape = shape.slice(0, -1); // Extract shape arrays
  this.color = shape[shape.length - 1]; // Extract color string
  this.position = { x: 0, y: 0, z: 0 };
  this.rotation = { x: 0, y: 0, z: 0 }; // Rotation state in degrees
}

function drawTetromino(gl, programInfo, buffers, modelViewMatrix, tetromino) {
  const colors = {
    cyan: [0.0, 1.0, 1.0, 1.0],
    blue: [0.0, 0.0, 1.0, 1.0],
    orange: [1.0, 0.5, 0.0, 1.0],
    yellow: [1.0, 1.0, 0.0, 1.0],
    green: [0.0, 1.0, 0.0, 1.0],
    purple: [0.5, 0.0, 0.5, 1.0],
    red: [1.0, 0.0, 0.0, 1.0],
  };

  const color = colors[tetromino.color];

  // Calculate the center of the shape
  const centerX = tetromino.shape[0].length / 2;
  const centerY = tetromino.shape.length / 2;

  for (let y = 0; y < tetromino.shape.length; y++) {
    for (let x = 0; x < tetromino.shape[y].length; x++) {
      if (tetromino.shape[y][x] !== 0) {
        const mvMatrix = mat4.clone(modelViewMatrix);
        // Translate to the center of the shape
        mat4.translate(mvMatrix, mvMatrix, [
          centerX + tetromino.position.x - 2,
          centerY + tetromino.position.y,
          tetromino.position.z, // Use z position for depth movement
        ]);

        // Apply rotations around the center of the shape
        mat4.rotateX(
          mvMatrix,
          mvMatrix,
          glMatrix.toRadian(tetromino.rotation.x)
        );
        mat4.rotateY(
          mvMatrix,
          mvMatrix,
          glMatrix.toRadian(tetromino.rotation.y)
        );
        mat4.rotateZ(
          mvMatrix,
          mvMatrix,
          glMatrix.toRadian(tetromino.rotation.z)
        );

        // Translate back
        mat4.translate(mvMatrix, mvMatrix, [x - centerX, y - centerY, 0]);

        gl.uniformMatrix4fv(
          programInfo.uniformLocations.modelViewMatrix,
          false,
          mvMatrix
        );

        drawColoredCube(gl, programInfo, buffers, color);
      }
    }
  }
}

function drawColoredCube(gl, programInfo, buffers, color) {
  const positions = [
    // Front face
    -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,

    // Back face
    -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5,

    // Top face
    -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5,

    // Bottom face
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,

    // Right face
    0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,

    // Left face
    -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5,
  ];

  const indices = [
    0, 1, 2, 0, 2, 3, // front
    4, 5, 6, 4, 6, 7, // back
    8, 9, 10, 8, 10, 11, // top
    12, 13, 14, 12, 14, 15, // bottom
    16, 17, 18, 16, 18, 19, // right
    20, 21, 22, 20, 22, 23, // left
  ];

  const colors = new Float32Array([
    ...color,
    ...color,
    ...color,
    ...color, // front
    ...color,
    ...color,
    ...color,
    ...color, // back
    ...color,
    ...color,
    ...color,
    ...color, // top
    ...color,
    ...color,
    ...color,
    ...color, // bottom
    ...color,
    ...color,
    ...color,
    ...color, // right
    ...color,
    ...color,
    ...color,
    ...color, // left
  ]);

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  const colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);

  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.vertexAttribPointer(
    programInfo.attribLocations.vertexPosition,
    3, // 3D coordinates
    gl.FLOAT,
    false,
    0,
    0
  );
  gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.vertexAttribPointer(
    programInfo.attribLocations.vertexColor,
    4, // 4 values for RGBA
    gl.FLOAT,
    false,
    0,
    0
  );
  gl.enableVertexAttribArray(programInfo.attribLocations.vertexColor);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

  const offset = 0;
  const vertexCount = indices.length;
  const type = gl.UNSIGNED_SHORT;
  gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
}

function initWebGL(canvas) {
  return canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
}

function initShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.error(
      "Unable to initialize the shader program: " + gl.getProgramInfoLog(shaderProgram)
    );
    return null;
  }
  return shaderProgram;
}

function loadShader(gl, type, source) {
  const shader = gl.createShader(type);

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(
      "An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader)
    );
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}
