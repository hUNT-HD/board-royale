const SVG_NS = "http://www.w3.org/2000/svg";
const S = 25; // Square size
const R = 1.5 * S * Math.sqrt(3); // Apothem of center hexagon (approx 64.95)
const CENTER = { x: 400, y: 400 };

const COLORS = [
  "#3498db", // Blue (Bottom, Player 1)
  "#f1c40f", // Yellow (Bottom Left, Player 2)
  "#9b59b6", // Purple (Top Left, Player 3)
  "#e74c3c", // Red (Top, Player 4)
  "#2ecc71", // Green (Top Right, Player 5)
  "#e67e22"  // Orange (Bottom Right, Player 6)
];

function createEl(type, attrs = {}) {
  const el = document.createElementNS(SVG_NS, type);
  for (const [key, val] of Object.entries(attrs)) {
    el.setAttribute(key, val);
  }
  return el;
}

function initBoard() {
  const container = document.getElementById("board-container");
  const svg = createEl("svg", {
    viewBox: "0 0 800 800",
    xmlns: SVG_NS
  });

  // Add definitions
  const defs = createEl("defs");
  
  // Center glow
  const centerGlow = createEl("radialGradient", { id: "centerGlow" });
  centerGlow.appendChild(createEl("stop", { offset: "0%", "stop-color": "#00bcd4", "stop-opacity": "0.4" }));
  centerGlow.appendChild(createEl("stop", { offset: "100%", "stop-color": "#0a0a0a", "stop-opacity": "1" }));
  defs.appendChild(centerGlow);

  svg.appendChild(defs);

  // Group for the entire board
  const boardGroup = createEl("g", { transform: `translate(${CENTER.x}, ${CENTER.y})` });

  // Draw the 6 arms
  for (let i = 0; i < 6; i++) {
    const angle = i * 60;
    const armGroup = createEl("g", { transform: `rotate(${angle})` });
    drawArm(armGroup, i);
    boardGroup.appendChild(armGroup);
  }

  // Draw Center Hexagon
  drawCenterHexagon(boardGroup);

  svg.appendChild(boardGroup);
  container.appendChild(svg);
}

function drawArm(group, index) {
  const color = COLORS[index];
  
  // The arm extends downwards (positive y)
  // Grid layout:
  // Left col: x from -1.5*S to -0.5*S
  // Mid col: x from -0.5*S to +0.5*S
  // Right col: x from +0.5*S to +1.5*S
  
  // 1. Draw Home Base (Large Colored Triangle + Player Tab)
  // Base triangle goes from top tip (0, R + 5S) to base (-4S, R + 10.5S) and (4S, R + 10.5S)
  const homePoints = [
    `0,${R + 5*S}`,
    `${4*S},${R + 10.5*S}`,
    `${-4*S},${R + 10.5*S}`
  ].join(" ");
  group.appendChild(createEl("polygon", {
    points: homePoints,
    fill: color,
    stroke: "black",
    "stroke-width": 1
  }));

  // Player Tab
  group.appendChild(createEl("rect", {
    x: -3*S,
    y: R + 10.5*S,
    width: 6*S,
    height: 20,
    fill: color,
    stroke: "black",
    "stroke-width": 1
  }));
  
  const text = createEl("text", {
    x: 0,
    y: R + 10.5*S + 14,
    "text-anchor": "middle",
    "font-family": "sans-serif",
    "font-size": "12",
    "font-weight": "bold",
    fill: "#000"
  });
  text.textContent = `Player ${index + 1}`;
  group.appendChild(text);

  // Inner White Triangle for tokens
  const innerPoints = [
    `0,${R + 5*S + 15}`,
    `${4*S - 18},${R + 10.5*S - 10}`,
    `${-(4*S - 18)},${R + 10.5*S - 10}`
  ].join(" ");
  group.appendChild(createEl("polygon", {
    points: innerPoints,
    fill: "white",
    stroke: "black",
    "stroke-width": 1
  }));

  // 4 Tokens
  const tokenCoords = [
    { x: 0, y: R + 5*S + 45 },
    { x: -22, y: R + 10.5*S - 30 },
    { x: 22, y: R + 10.5*S - 30 },
    { x: 0, y: R + 10.5*S - 45 }
  ];
  tokenCoords.forEach(t => {
    group.appendChild(createEl("circle", {
      cx: t.x, cy: t.y, r: 8,
      fill: color,
      stroke: "white",
      "stroke-width": 2
    }));
  });

  // 2. Draw Grid (White and Colored squares)
  // Left Column
  for (let row = 0; row < 6; row++) {
    const x = -1.5 * S;
    const y = R + row * S;
    const cellGroup = createEl("g");
    
    cellGroup.appendChild(createEl("rect", {
      x, y, width: S, height: S,
      fill: "white",
      stroke: "black",
      "stroke-width": 1
    }));
    
    // Star on Left Col, Row 2 (safe square)
    if (row === 2) {
      drawStar(cellGroup, x + S/2, y + S/2);
    }
    
    // Arrow on Left Col, Row 5 (pointing RIGHT)
    if (row === 5) {
      drawArrow(cellGroup, x + S/2, y + S/2, "RIGHT", color);
    }

    group.appendChild(cellGroup);
  }

  // Right Column
  for (let row = 0; row < 6; row++) {
    const x = 0.5 * S;
    const y = R + row * S;
    const cellGroup = createEl("g");
    
    // Start square is colored
    const isStart = (row === 5);
    
    cellGroup.appendChild(createEl("rect", {
      x, y, width: S, height: S,
      fill: isStart ? color : "white",
      stroke: "black",
      "stroke-width": 1
    }));
    
    if (isStart) {
      drawArrow(cellGroup, x + S/2, y + S/2, "UP", "white");
    }

    group.appendChild(cellGroup);
  }

  // Middle Column (Home Straight)
  for (let row = 0; row < 5; row++) {
    const x = -0.5 * S;
    const y = R + row * S;
    group.appendChild(createEl("rect", {
      x, y, width: S, height: S,
      fill: color,
      stroke: "black",
      "stroke-width": 1
    }));
  }
  
  // Triangle tip arrow on Middle Col Row 5 (points UP)
  const entryArrow = createEl("polygon", {
    points: `0,${R + 5.2*S} -8,${R + 5.8*S} 8,${R + 5.8*S}`,
    fill: "white"
  });
  group.appendChild(entryArrow);
}

function drawCenterHexagon(group) {
  const rOut = 3 * S;
  let points = [];
  for (let i = 0; i < 6; i++) {
    const angleRad = (i * 60 + 30) * Math.PI / 180;
    const vx = rOut * Math.cos(angleRad);
    const vy = rOut * Math.sin(angleRad);
    points.push(`${vx},${vy}`);
  }
  
  group.appendChild(createEl("polygon", {
    points: points.join(" "),
    fill: "url(#centerGlow)",
    stroke: "black",
    "stroke-width": 2
  }));
  
  // Center Die
  group.appendChild(createEl("rect", {
    x: -15, y: -15, width: 30, height: 30, rx: 5,
    fill: "#00bcd4",
    stroke: "rgba(255,255,255,0.5)",
    "stroke-width": 1
  }));
  group.appendChild(createEl("circle", {
    cx: 0, cy: 0, r: 4, fill: "white"
  }));
}

function drawStar(parent, cx, cy) {
  // Simple 5-pointed star
  const points = "0,-8 2,-2 8,-2 3,2 5,8 0,5 -5,8 -3,2 -8,-2 -2,-2";
  const star = createEl("polygon", {
    points: points,
    transform: `translate(${cx}, ${cy})`,
    fill: "none",
    stroke: "black",
    "stroke-width": 1
  });
  parent.appendChild(star);
}

function drawArrow(parent, cx, cy, direction, color) {
  let pathD = "";
  if (direction === "UP") {
    pathD = "M 0,5 L 0,-5 M -5,0 L 0,-5 L 5,0";
  } else if (direction === "RIGHT") {
    pathD = "M -5,0 L 5,0 M 0,-5 L 5,0 L 0,5";
  }
  
  const arrow = createEl("path", {
    d: pathD,
    transform: `translate(${cx}, ${cy})`,
    fill: "none",
    stroke: color,
    "stroke-width": 2,
    "stroke-linecap": "round",
    "stroke-linejoin": "round"
  });
  parent.appendChild(arrow);
}

window.addEventListener('DOMContentLoaded', initBoard);
