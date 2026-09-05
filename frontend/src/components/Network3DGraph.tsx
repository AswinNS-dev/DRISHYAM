import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as THREE from "three";
import { ZoomIn, ZoomOut, Maximize2, Crosshair, Sparkles } from "lucide-react";
import type { GraphNode, GraphEdge } from "./NetworkGraph";

export const ENTITY_COLORS: Record<string, string> = {
  PERSON: "#0ea5e9",        // Cyan / Blue
  PHONE: "#facc15",         // Yellow
  VEHICLE: "#c084fc",       // Purple
  LOCATION: "#4ade80",      // Green
  ORGANIZATION: "#2dd4bf",  // Teal
  GANG: "#2dd4bf",          // Teal (Syndicate)
  BANK_ACCOUNT: "#fb923c",  // Orange
  CASE: "#ef4444",          // Red
  EVENT: "#ec4899",         // Pink
  UNKNOWN: "#94a3b8",       // Gray
};

export const POLICE_RELATION_LABELS: Record<string, string> = {
  CALL: "Associated Phone Call",
  COMMUNICATED_WITH: "Direct Communication",
  TRANSACTION: "Financial Transfer",
  VEHICLE_ASSOCIATION: "Registered / Associated Vehicle",
  LOCATION_VISIT: "Co-Located Visit",
  CASE_ASSOCIATION: "Linked Investigation Case",
  ACCUSED_IN: "Accused in Formal FIR",
  SUSPECT_IN: "Flagged Suspect in Record",
  ORGANIZATION_ASSOCIATION: "Syndicate / Group Affiliation",
  ALIAS: "Documented Alias",
  OTHER: "Corroborated Association",
};

export function getEntityColor(type: string): string {
  return ENTITY_COLORS[type?.toUpperCase()] || ENTITY_COLORS.UNKNOWN;
}

export function getPoliceRelationLabel(type: string): string {
  if (!type) return "Corroborated Link";
  const upper = type.toUpperCase().replace(/\s+/g, "_");
  return POLICE_RELATION_LABELS[upper] || type.replace(/_/g, " ");
}

interface SimNode3D extends GraphNode {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: string;
  degree: number;
}

interface SimEdge3D {
  id?: string;
  source: SimNode3D;
  target: SimNode3D;
  relationship_type: string;
  confidence_score: number;
  evidence_id?: string;
}

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId?: string | null;
  onSelect: (n: GraphNode) => void;
  onSelectEdge?: (edge: any) => void;
  highlightPath?: string[];
  focusDegree?: 1 | 2 | 3;
  onDegreeChange?: (deg: 1 | 2 | 3) => void;
  onResetFocus?: () => void;
}

export default function Network3DGraph({
  nodes,
  edges,
  selectedNodeId,
  onSelect,
  onSelectEdge,
  highlightPath,
  focusDegree = 1,
  onDegreeChange,
  onResetFocus,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);

  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<SimEdge3D | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [cameraDistance, setCameraDistance] = useState(380);

  // References for Three.js state
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const simNodesRef = useRef<SimNode3D[]>([]);
  const simEdgesRef = useRef<SimEdge3D[]>([]);
  const nodeMeshMapRef = useRef<Map<string, THREE.Group>>(new Map());
  const edgeLineMapRef = useRef<Map<string, THREE.LineSegments | THREE.Line>>(new Map());
  const pulseParticlesRef = useRef<THREE.Points | null>(null);
  const pulseDataRef = useRef<{ edgeIdx: number; t: number; speed: number }[]>([]);

  // Camera animation tween state
  const cameraTargetRef = useRef<{
    pos: THREE.Vector3;
    lookAt: THREE.Vector3;
    startPos: THREE.Vector3;
    startLookAt: THREE.Vector3;
    curLookAt: THREE.Vector3;
    progress: number;
    active: boolean;
  }>({
    pos: new THREE.Vector3(0, 80, 420),
    lookAt: new THREE.Vector3(0, 0, 0),
    startPos: new THREE.Vector3(0, 80, 420),
    startLookAt: new THREE.Vector3(0, 0, 0),
    curLookAt: new THREE.Vector3(0, 0, 0),
    progress: 1,
    active: false,
  });

  // Mouse orbit / pan interaction state
  const isDraggingRef = useRef(false);
  const dragButtonRef = useRef(0);
  const prevMouseRef = useRef({ x: 0, y: 0 });
  const cameraCenterRef = useRef(new THREE.Vector3(0, 0, 0));

  // Subgraph calculation
  const subgraphData = useMemo(() => {
    if (!selectedNodeId) {
      return {
        highlightNodeIds: new Set<string>(),
        highlightEdgeIds: new Set<string>(),
        directNeighbors: new Set<string>(),
      };
    }

    const adj = new Map<string, Set<string>>();
    edges.forEach((e) => {
      if (!adj.has(e.source_entity_id)) adj.set(e.source_entity_id, new Set());
      if (!adj.has(e.target_entity_id)) adj.set(e.target_entity_id, new Set());
      adj.get(e.source_entity_id)!.add(e.target_entity_id);
      adj.get(e.target_entity_id)!.add(e.source_entity_id);
    });

    const direct = adj.get(selectedNodeId) || new Set();
    const highlightNodes = new Set<string>([selectedNodeId]);

    // Add degree 1
    direct.forEach((id) => highlightNodes.add(id));

    // Add degree 2 if requested
    if (focusDegree >= 2) {
      direct.forEach((dId) => {
        const d2 = adj.get(dId);
        if (d2) d2.forEach((id) => highlightNodes.add(id));
      });
    }

    const highlightEdges = new Set<string>();
    edges.forEach((e) => {
      if (highlightNodes.has(e.source_entity_id) && highlightNodes.has(e.target_entity_id)) {
        highlightEdges.add(e.id || `${e.source_entity_id}-${e.target_entity_id}`);
      }
    });

    return {
      highlightNodeIds: highlightNodes,
      highlightEdgeIds: highlightEdges,
      directNeighbors: direct,
    };
  }, [selectedNodeId, edges, focusDegree]);

  // Compute 3D physics layout
  useEffect(() => {
    if (nodes.length === 0) return;

    const degreeMap = new Map<string, number>();
    edges.forEach((e) => {
      degreeMap.set(e.source_entity_id, (degreeMap.get(e.source_entity_id) || 0) + 1);
      degreeMap.set(e.target_entity_id, (degreeMap.get(e.target_entity_id) || 0) + 1);
    });

    const nodeMap = new Map<string, SimNode3D>();
    const count = nodes.length;
    const radius = Math.cbrt(count) * 65;

    nodes.forEach((n, i) => {
      // Golden spiral distribution on sphere as initial position
      const phi = Math.acos(1 - (2 * (i + 0.5)) / count);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const r = radius * (0.6 + 0.4 * Math.sin(i * 1.7));

      nodeMap.set(n.id, {
        ...n,
        x: r * Math.sin(phi) * Math.cos(theta),
        y: r * Math.sin(phi) * Math.sin(theta) * 0.7,
        z: r * Math.cos(phi),
        vx: 0,
        vy: 0,
        vz: 0,
        color: getEntityColor(n.type),
        degree: degreeMap.get(n.id) || 0,
      });
    });

    const simNodes = Array.from(nodeMap.values());
    const simEdges: SimEdge3D[] = [];
    edges.forEach((e) => {
      const src = nodeMap.get(e.source_entity_id);
      const tgt = nodeMap.get(e.target_entity_id);
      if (src && tgt) {
        simEdges.push({
          id: e.id || `${e.source_entity_id}-${e.target_entity_id}`,
          source: src,
          target: tgt,
          relationship_type: e.relationship_type,
          confidence_score: e.confidence_score,
          evidence_id: e.evidence_id,
        });
      }
    });

    // 3D Force Simulation Loop (Deterministic layout solve)
    const iterations = 80;
    const idealDist = 75;
    for (let iter = 0; iter < iterations; iter++) {
      const temp = 1 - iter / iterations;

      // Repulsion between all nodes
      for (let i = 0; i < simNodes.length; i++) {
        const ni = simNodes[i];
        for (let j = i + 1; j < simNodes.length; j++) {
          const nj = simNodes[j];
          let dx = nj.x - ni.x;
          let dy = nj.y - ni.y;
          let dz = nj.z - ni.z;
          let distSq = dx * dx + dy * dy + dz * dz;
          if (distSq < 1) distSq = 1;
          const dist = Math.sqrt(distSq);
          if (dist < 320) {
            const force = (3000 / (distSq + 100)) * temp;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            const fz = (dz / dist) * force;
            ni.vx -= fx;
            ni.vy -= fy;
            ni.vz -= fz;
            nj.vx += fx;
            nj.vy += fy;
            nj.vz += fz;
          }
        }
      }

      // Spring attraction along edges
      for (let e = 0; e < simEdges.length; e++) {
        const edge = simEdges[e];
        const src = edge.source;
        const tgt = edge.target;
        const dx = tgt.x - src.x;
        const dy = tgt.y - src.y;
        const dz = tgt.z - src.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        const delta = dist - idealDist;
        const force = delta * 0.05 * temp;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        const fz = (dz / dist) * force;
        src.vx += fx;
        src.vy += fy;
        src.vz += fz;
        tgt.vx -= fx;
        tgt.vy -= fy;
        tgt.vz -= fz;
      }

      // Center gravity
      for (let i = 0; i < simNodes.length; i++) {
        const n = simNodes[i];
        n.vx -= n.x * 0.02 * temp;
        n.vy -= n.y * 0.02 * temp;
        n.vz -= n.z * 0.02 * temp;

        n.x += n.vx * 0.3;
        n.y += n.vy * 0.3;
        n.z += n.vz * 0.3;
        n.vx *= 0.6;
        n.vy *= 0.6;
        n.vz *= 0.6;
      }
    }

    simNodesRef.current = simNodes;
    simEdgesRef.current = simEdges;
  }, [nodes, edges]);

  // Main Three.js Scene Setup & Render Loop
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || 900;
    const height = container.clientHeight || 650;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#070b14");
    scene.fog = new THREE.FogExp2(0x070b14, 0.0012);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 1, 3000);
    camera.position.set(0, 90, 420);
    cameraRef.current = camera;
    cameraTargetRef.current.curLookAt.set(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x38bdf8, 1.2);
    dirLight1.position.set(150, 300, 200);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x818cf8, 0.6);
    dirLight2.position.set(-150, -100, -150);
    scene.add(dirLight2);

    // Subtle 3D Radar Grid Ground Plane
    const gridHelper = new THREE.GridHelper(1000, 40, 0x1e293b, 0x0f172a);
    gridHelper.position.y = -180;
    scene.add(gridHelper);

    // Depth Concentric Rings
    const ringGeo = new THREE.RingGeometry(120, 121, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x1e3a5f, side: THREE.DoubleSide, transparent: true, opacity: 0.25 });
    const ringMesh1 = new THREE.Mesh(ringGeo, ringMat);
    ringMesh1.rotation.x = Math.PI / 2;
    ringMesh1.position.y = -179;
    scene.add(ringMesh1);

    const ringGeo2 = new THREE.RingGeometry(280, 281.5, 64);
    const ringMesh2 = new THREE.Mesh(ringGeo2, ringMat);
    ringMesh2.rotation.x = Math.PI / 2;
    ringMesh2.position.y = -179;
    scene.add(ringMesh2);

    // Create Nodes & Edge Objects
    const simNodes = simNodesRef.current;
    const simEdges = simEdgesRef.current;
    const nodeMeshMap = new Map<string, THREE.Group>();
    const edgeLineMap = new Map<string, THREE.LineSegments | THREE.Line>();

    // Shared Geometries & Materials
    const sphereGeo = new THREE.SphereGeometry(1, 24, 24);

    // Build Node Meshes
    simNodes.forEach((n) => {
      const group = new THREE.Group();
      group.position.set(n.x, n.y, n.z);
      group.userData = { id: n.id, node: n };

      // Base radius by type
      let radius = 6.5;
      if (n.type === "PERSON") radius = 8.5;
      if (n.type === "CASE" || n.type === "GANG") radius = 9.5;

      // Inner Core
      const coreMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(n.color),
        emissive: new THREE.Color(n.color),
        emissiveIntensity: 0.45,
        roughness: 0.3,
        metalness: 0.2,
      });
      const coreMesh = new THREE.Mesh(sphereGeo, coreMat);
      coreMesh.scale.set(radius, radius, radius);
      group.add(coreMesh);

      // Outer Halo Ring for high-degree or person nodes
      const haloGeo = new THREE.RingGeometry(radius * 1.3, radius * 1.5, 32);
      const haloMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(n.color),
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      });
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);
      haloMesh.name = "halo";
      group.add(haloMesh);

      // Selected Beacon Ring (invisible by default)
      const beaconGeo = new THREE.RingGeometry(radius * 1.8, radius * 2.2, 32);
      const beaconMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      });
      const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
      beaconMesh.name = "beacon";
      group.add(beaconMesh);

      scene.add(group);
      nodeMeshMap.set(n.id, group);
    });

    // Build Edges
    simEdges.forEach((e) => {
      const points = [
        new THREE.Vector3(e.source.x, e.source.y, e.source.z),
        new THREE.Vector3(e.target.x, e.target.y, e.target.z),
      ];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x334155,
        transparent: true,
        opacity: Math.max(0.18, (e.confidence_score || 0.8) * 0.4),
        linewidth: 1,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      line.userData = { edge: e, id: e.id };
      scene.add(line);
      edgeLineMap.set(e.id || `${e.source.id}-${e.target.id}`, line);
    });

    // Flowing Signal Pulses
    const pulseCount = Math.min(simEdges.length * 2, 240);
    const pulseGeo = new THREE.BufferGeometry();
    const pulsePositions = new Float32Array(pulseCount * 3);
    const pulseColors = new Float32Array(pulseCount * 3);

    const pulseData: { edgeIdx: number; t: number; speed: number }[] = [];
    const cyan = new THREE.Color(0x38bdf8);

    for (let p = 0; p < pulseCount; p++) {
      const edgeIdx = p % Math.max(simEdges.length, 1);
      pulseData.push({
        edgeIdx,
        t: Math.random(),
        speed: 0.003 + Math.random() * 0.005,
      });
      cyan.toArray(pulseColors, p * 3);
    }

    pulseGeo.setAttribute("position", new THREE.BufferAttribute(pulsePositions, 3));
    pulseGeo.setAttribute("color", new THREE.BufferAttribute(pulseColors, 3));

    const pulseMat = new THREE.PointsMaterial({
      size: 4.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const pulsePoints = new THREE.Points(pulseGeo, pulseMat);
    scene.add(pulsePoints);

    pulseParticlesRef.current = pulsePoints;
    pulseDataRef.current = pulseData;
    nodeMeshMapRef.current = nodeMeshMap;
    edgeLineMapRef.current = edgeLineMap;

    // Resize Observer
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth || 900;
      const h = container.clientHeight || 650;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // Animation Loop
    let animId = 0;
    let clock = new THREE.Clock();

    const render = () => {
      const elapsedTime = clock.getElapsedTime();

      // Update Camera Tween (smooth transition)
      const ct = cameraTargetRef.current;
      if (ct.active) {
        ct.progress += 0.04;
        if (ct.progress >= 1) {
          ct.progress = 1;
          ct.active = false;
        }
        // Smooth easing curve
        const ease = 0.5 - 0.5 * Math.cos(ct.progress * Math.PI);
        camera.position.lerpVectors(ct.startPos, ct.pos, ease);
        ct.curLookAt.lerpVectors(ct.startLookAt, ct.lookAt, ease);
        camera.lookAt(ct.curLookAt);
        cameraCenterRef.current.copy(ct.curLookAt);
      } else {
        camera.lookAt(cameraCenterRef.current);
      }

      // Orient halos and beacons to face camera
      nodeMeshMap.forEach((grp) => {
        const halo = grp.getObjectByName("halo");
        if (halo) halo.quaternion.copy(camera.quaternion);
        const beacon = grp.getObjectByName("beacon") as THREE.Mesh | undefined;
        if (beacon) {
          beacon.quaternion.copy(camera.quaternion);
          if (beacon.material instanceof THREE.Material && (beacon.material as any).opacity > 0) {
            const pulseScale = 1 + 0.15 * Math.sin(elapsedTime * 4);
            beacon.scale.set(pulseScale, pulseScale, pulseScale);
          }
        }
      });

      // Update Signal Pulses along Edges
      if (pulseParticlesRef.current && simEdges.length > 0) {
        const positions = pulseParticlesRef.current.geometry.attributes.position.array as Float32Array;
        const pData = pulseDataRef.current;

        for (let i = 0; i < pData.length; i++) {
          const item = pData[i];
          const edge = simEdges[item.edgeIdx];
          if (!edge) continue;

          item.t += item.speed;
          if (item.t > 1) item.t = 0;

          const px = edge.source.x + (edge.target.x - edge.source.x) * item.t;
          const py = edge.source.y + (edge.target.y - edge.source.y) * item.t;
          const pz = edge.source.z + (edge.target.z - edge.source.z) * item.t;

          positions[i * 3] = px;
          positions[i * 3 + 1] = py;
          positions[i * 3 + 2] = pz;
        }
        pulseParticlesRef.current.geometry.attributes.position.needsUpdate = true;
      }

      renderer.render(scene, camera);
      drawMinimap();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      if (container) container.innerHTML = "";
    };
  }, []);

  // Update Visual State based on Selection & Subgraph Highlighting
  useEffect(() => {
    const nodeMeshMap = nodeMeshMapRef.current;
    const edgeLineMap = edgeLineMapRef.current;
    const { highlightNodeIds, highlightEdgeIds } = subgraphData;
    const isSelectedMode = Boolean(selectedNodeId);
    const pathSet = new Set(highlightPath || []);

    // Update Nodes
    nodeMeshMap.forEach((grp, id) => {
      const core = grp.children[0] as THREE.Mesh;
      const beacon = grp.getObjectByName("beacon") as THREE.Mesh;
      const isCentral = id === selectedNodeId;
      const isPath = pathSet.has(id);
      const isHighlighted = highlightNodeIds.has(id);

      if (core && core.material instanceof THREE.MeshStandardMaterial) {
        if (isCentral) {
          core.scale.set(13, 13, 13);
          core.material.emissiveIntensity = 1.0;
        } else if (isPath) {
          core.scale.set(11, 11, 11);
          core.material.emissiveIntensity = 0.9;
        } else if (isHighlighted) {
          core.scale.set(8.5, 8.5, 8.5);
          core.material.emissiveIntensity = 0.6;
        } else if (isSelectedMode) {
          // Dim peripheral nodes when an entity is focused
          core.scale.set(5.5, 5.5, 5.5);
          core.material.emissiveIntensity = 0.15;
          core.material.opacity = 0.35;
          core.material.transparent = true;
        } else {
          // Default Overview
          core.scale.set(7, 7, 7);
          core.material.emissiveIntensity = 0.45;
          core.material.opacity = 1.0;
          core.material.transparent = false;
        }
      }

      if (beacon && beacon.material instanceof THREE.MeshBasicMaterial) {
        beacon.material.opacity = isCentral ? 0.8 : isPath ? 0.6 : 0;
      }
    });

    // Update Edges
    edgeLineMap.forEach((line, edgeId) => {
      const edge = line.userData.edge as SimEdge3D;
      const isPathEdge = edge && pathSet.has(edge.source.id) && pathSet.has(edge.target.id);
      const isHighlighted = highlightEdgeIds.has(edgeId);

      if (line.material instanceof THREE.LineBasicMaterial) {
        if (isPathEdge) {
          line.material.color.set(0x38bdf8); // Bright Cyan for traced route
          line.material.opacity = 1.0;
        } else if (isHighlighted) {
          line.material.color.set(0x60a5fa); // Electric blue for focused connections
          line.material.opacity = 0.85;
        } else if (isSelectedMode) {
          line.material.color.set(0x1e293b);
          line.material.opacity = 0.08; // Dim non-subgraph links
        } else {
          line.material.color.set(0x334155);
          line.material.opacity = Math.max(0.18, (edge?.confidence_score || 0.8) * 0.38);
        }
      }
    });
  }, [selectedNodeId, subgraphData, highlightPath]);

  // Smooth Focus Camera to Selected Node
  const focusOnNode = useCallback((node: SimNode3D) => {
    if (!cameraRef.current) return;
    const camera = cameraRef.current;

    const targetPos = new THREE.Vector3(
      node.x + 80,
      node.y + 40,
      node.z + 120
    );

    const ct = cameraTargetRef.current;
    ct.startPos.copy(camera.position);
    ct.startLookAt.copy(cameraCenterRef.current);
    ct.pos.copy(targetPos);
    ct.lookAt.set(node.x, node.y, node.z);
    ct.progress = 0;
    ct.active = true;
  }, []);

  // Center camera when selected node changes
  useEffect(() => {
    if (!selectedNodeId) return;
    const node = simNodesRef.current.find((n) => n.id === selectedNodeId);
    if (node) {
      focusOnNode(node);
    }
  }, [selectedNodeId, focusOnNode]);

  // Reset Camera View to Network Overview
  const handleResetView = useCallback(() => {
    if (!cameraRef.current) return;
    const camera = cameraRef.current;

    const ct = cameraTargetRef.current;
    ct.startPos.copy(camera.position);
    ct.startLookAt.copy(cameraCenterRef.current);
    ct.pos.set(0, 90, 420);
    ct.lookAt.set(0, 0, 0);
    ct.progress = 0;
    ct.active = true;

    if (onResetFocus) onResetFocus();
  }, [onResetFocus]);

  // Zoom Helpers
  const handleZoomIn = () => {
    if (!cameraRef.current) return;
    const cam = cameraRef.current;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    cam.position.addScaledVector(dir, 50);
    setCameraDistance(Math.round(cam.position.distanceTo(cameraCenterRef.current)));
  };

  const handleZoomOut = () => {
    if (!cameraRef.current) return;
    const cam = cameraRef.current;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    cam.position.addScaledVector(dir, -50);
    setCameraDistance(Math.round(cam.position.distanceTo(cameraCenterRef.current)));
  };

  // Center on current selection
  const handleCenterSelected = () => {
    if (!selectedNodeId) return;
    const node = simNodesRef.current.find((n) => n.id === selectedNodeId);
    if (node) focusOnNode(node);
  };

  // Mouse Interaction: Orbit, Pan, Click, Hover Raycasting
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const raycaster = new THREE.Raycaster();
    raycaster.params.Line = { threshold: 4 };
    const mouse = new THREE.Vector2();

    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      dragButtonRef.current = e.button;
      prevMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setMousePos({ x, y });

      if (isDraggingRef.current && cameraRef.current) {
        const dx = e.clientX - prevMouseRef.current.x;
        const dy = e.clientY - prevMouseRef.current.y;
        prevMouseRef.current = { x: e.clientX, y: e.clientY };

        const cam = cameraRef.current;

        // Orbit (Left Click)
        if (dragButtonRef.current === 0) {
          const center = cameraCenterRef.current;
          const offset = cam.position.clone().sub(center);
          let radius = offset.length();

          let theta = Math.atan2(offset.x, offset.z);
          let phi = Math.acos(Math.max(-1, Math.min(1, offset.y / radius)));

          theta -= dx * 0.007;
          phi -= dy * 0.007;
          phi = Math.max(0.05, Math.min(Math.PI - 0.05, phi));

          offset.x = radius * Math.sin(phi) * Math.sin(theta);
          offset.y = radius * Math.cos(phi);
          offset.z = radius * Math.sin(phi) * Math.cos(theta);

          cam.position.copy(center).add(offset);
          cam.lookAt(center);
        }
        // Pan (Right Click or Middle Click)
        else if (dragButtonRef.current === 2 || dragButtonRef.current === 1) {
          const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
          const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
          const panDist = cam.position.distanceTo(cameraCenterRef.current) * 0.0018;

          const panDelta = right.multiplyScalar(-dx * panDist).add(up.multiplyScalar(dy * panDist));
          cam.position.add(panDelta);
          cameraCenterRef.current.add(panDelta);
        }
        return;
      }

      // Raycasting for Hover Detection
      if (!cameraRef.current || !sceneRef.current) return;
      mouse.x = (x / rect.width) * 2 - 1;
      mouse.y = -(y / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, cameraRef.current);

      const nodeGroups = Array.from(nodeMeshMapRef.current.values());
      const intersects = raycaster.intersectObjects(nodeGroups, true);

      if (intersects.length > 0) {
        let currentObj: THREE.Object3D | null = intersects[0].object;
        while (currentObj && !currentObj.userData.node) {
          currentObj = currentObj.parent;
        }
        if (currentObj && currentObj.userData.node) {
          setHoveredNode(currentObj.userData.node);
          setHoveredEdge(null);
          container.style.cursor = "pointer";
          return;
        }
      }

      // Edge intersection check
      const edgeLines = Array.from(edgeLineMapRef.current.values());
      const edgeHits = raycaster.intersectObjects(edgeLines, false);
      if (edgeHits.length > 0 && edgeHits[0].object.userData.edge) {
        setHoveredEdge(edgeHits[0].object.userData.edge);
        setHoveredNode(null);
        container.style.cursor = "pointer";
        return;
      }

      setHoveredNode(null);
      setHoveredEdge(null);
      container.style.cursor = "grab";
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    const handleClick = (e: MouseEvent) => {
      // Ignore click if it was part of a drag
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (!cameraRef.current || !sceneRef.current) return;
      mouse.x = (x / rect.width) * 2 - 1;
      mouse.y = -(y / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, cameraRef.current);

      const nodeGroups = Array.from(nodeMeshMapRef.current.values());
      const intersects = raycaster.intersectObjects(nodeGroups, true);

      if (intersects.length > 0) {
        let currentObj: THREE.Object3D | null = intersects[0].object;
        while (currentObj && !currentObj.userData.node) {
          currentObj = currentObj.parent;
        }
        if (currentObj && currentObj.userData.node) {
          const clickedNode = currentObj.userData.node as SimNode3D;
          onSelect(clickedNode);
          focusOnNode(clickedNode);
          return;
        }
      }

      // Check edge click
      if (onSelectEdge) {
        const edgeLines = Array.from(edgeLineMapRef.current.values());
        const edgeHits = raycaster.intersectObjects(edgeLines, false);
        if (edgeHits.length > 0 && edgeHits[0].object.userData.edge) {
          onSelectEdge(edgeHits[0].object.userData.edge);
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!cameraRef.current) return;
      const cam = cameraRef.current;
      const center = cameraCenterRef.current;
      const dir = cam.position.clone().sub(center);
      const curDist = dir.length();
      const zoomFactor = e.deltaY > 0 ? 1.08 : 0.92;
      const newDist = Math.max(40, Math.min(1200, curDist * zoomFactor));
      dir.setLength(newDist);
      cam.position.copy(center).add(dir);
      setCameraDistance(Math.round(newDist));
    };

    const handleContextMenu = (e: MouseEvent) => e.preventDefault();

    container.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    container.addEventListener("click", handleClick);
    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("contextmenu", handleContextMenu);

    return () => {
      container.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      container.removeEventListener("click", handleClick);
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [onSelect, onSelectEdge, focusOnNode]);

  // Draw 2D Top-Down Minimap Radar
  const drawMinimap = useCallback(() => {
    const canvas = minimapCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mw = 140;
    const mh = 90;
    ctx.clearRect(0, 0, mw, mh);

    // Radar background
    ctx.fillStyle = "#070c18";
    ctx.fillRect(0, 0, mw, mh);
    ctx.strokeStyle = "rgba(56, 189, 248, 0.2)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, mw, mh);

    // Crosshairs
    ctx.strokeStyle = "rgba(148, 163, 184, 0.1)";
    ctx.beginPath();
    ctx.moveTo(mw / 2, 0);
    ctx.lineTo(mw / 2, mh);
    ctx.moveTo(0, mh / 2);
    ctx.lineTo(mw, mh / 2);
    ctx.stroke();

    const simNodes = simNodesRef.current;
    if (simNodes.length === 0) return;

    const scale = 0.22;
    const ox = mw / 2;
    const oy = mh / 2;

    // Draw nodes on minimap
    for (let i = 0; i < simNodes.length; i++) {
      const n = simNodes[i];
      const mx = n.x * scale + ox;
      const my = n.z * scale + oy;
      const isSelected = n.id === selectedNodeId;

      ctx.beginPath();
      ctx.arc(mx, my, isSelected ? 3.5 : 1.5, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? "#ffffff" : n.color;
      ctx.fill();
    }

    // Camera Frustum Indicator
    if (cameraRef.current) {
      const cam = cameraRef.current;
      const cx = cam.position.x * scale + ox;
      const cy = cam.position.z * scale + oy;
      ctx.strokeStyle = "rgba(56, 189, 248, 0.7)";
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - 5, cy - 4, 10, 8);
    }
  }, [selectedNodeId]);

  return (
    <div className="w-full h-full relative overflow-hidden select-none bg-[#070b14] font-sans">
      {/* Three.js Canvas Container */}
      <div ref={mountRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />

      {/* Top Floating Investigation Mode Badge */}
      <div className="absolute top-3 left-4 z-10 flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(15,23,42,0.85)] border border-[rgba(56,189,248,0.3)] backdrop-blur-md shadow-lg text-[11px] font-semibold text-[var(--intel-sky)]">
          <Sparkles size={13} className="text-[var(--intel-sky)] animate-pulse" />
          <span>3D NEURAL INVESTIGATION MAP</span>
        </div>

        {selectedNodeId && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[rgba(15,23,42,0.85)] border border-amber-500/30 backdrop-blur-md text-[11px] font-mono text-amber-400">
            <Crosshair size={12} />
            <span>SUBGRAPH FOCUS ACTIVE</span>
          </div>
        )}
      </div>

      {/* Camera & Subgraph Controls (Top Right) */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
        {/* Navigation Toolbar */}
        <div className="flex flex-col gap-1 bg-[rgba(15,23,42,0.9)] p-1.5 rounded-xl border border-[var(--border-subtle)] shadow-xl backdrop-blur-md">
          <button
            onClick={handleZoomIn}
            className="p-2 rounded-lg hover:bg-[rgba(56,189,248,0.15)] text-[var(--text-secondary)] hover:text-white transition-all"
            title="Zoom In"
          >
            <ZoomIn size={15} />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 rounded-lg hover:bg-[rgba(56,189,248,0.15)] text-[var(--text-secondary)] hover:text-white transition-all"
            title="Zoom Out"
          >
            <ZoomOut size={15} />
          </button>
          <button
            onClick={handleResetView}
            className="p-2 rounded-lg hover:bg-[rgba(56,189,248,0.15)] text-[var(--text-secondary)] hover:text-white transition-all"
            title="Reset to Network Overview"
          >
            <Maximize2 size={15} />
          </button>
          {selectedNodeId && (
            <button
              onClick={handleCenterSelected}
              className="p-2 rounded-lg hover:bg-[rgba(56,189,248,0.2)] text-[var(--intel-sky)] transition-all"
              title="Recenter On Selected Entity"
            >
              <Crosshair size={15} />
            </button>
          )}
        </div>

        {/* Subgraph Connection Expansion (1st Degree / 2nd Degree) */}
        {selectedNodeId && onDegreeChange && (
          <div className="flex flex-col gap-1 bg-[rgba(15,23,42,0.9)] p-2 rounded-xl border border-[var(--border-subtle)] shadow-xl backdrop-blur-md text-[10px]">
            <span className="text-[var(--text-muted)] font-mono uppercase px-1">Scope</span>
            <div className="flex gap-1">
              <button
                onClick={() => onDegreeChange(1)}
                className={`px-2 py-1 rounded font-mono font-bold transition-all ${
                  focusDegree === 1
                    ? "bg-[var(--intel-sky)] text-slate-900 shadow-sm"
                    : "bg-slate-800 text-[var(--text-secondary)] hover:text-white"
                }`}
              >
                1° Hop
              </button>
              <button
                onClick={() => onDegreeChange(2)}
                className={`px-2 py-1 rounded font-mono font-bold transition-all ${
                  focusDegree === 2
                    ? "bg-[var(--intel-sky)] text-slate-900 shadow-sm"
                    : "bg-slate-800 text-[var(--text-secondary)] hover:text-white"
                }`}
              >
                2° Hops
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Hover Tooltip */}
      {hoveredNode && (
        <div
          className="pointer-events-none fixed z-50 p-2.5 rounded-lg bg-[rgba(15,23,42,0.95)] border border-[rgba(56,189,248,0.4)] shadow-2xl backdrop-blur-md text-xs text-white max-w-xs"
          style={{
            left: mousePos.x + 16,
            top: mousePos.y + 16,
          }}
        >
          <div className="flex items-center gap-1.5 font-bold">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: getEntityColor(hoveredNode.type) }}
            />
            <span className="truncate">{hoveredNode.name}</span>
          </div>
          <div className="text-[10px] font-mono text-[var(--intel-sky)] mt-0.5 uppercase">
            {hoveredNode.type} · {hoveredNode.role_label || "Recorded Associate"}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between gap-3">
            <span>ID: {hoveredNode.id.slice(0, 10)}...</span>
            <span className="text-amber-400">Click to focus</span>
          </div>
        </div>
      )}

      {/* Floating Hover Edge Tooltip */}
      {hoveredEdge && (
        <div
          className="pointer-events-none fixed z-50 p-2.5 rounded-lg bg-[rgba(15,23,42,0.95)] border border-slate-700 shadow-2xl backdrop-blur-md text-xs text-white"
          style={{
            left: mousePos.x + 16,
            top: mousePos.y + 16,
          }}
        >
          <div className="text-[10px] font-mono text-amber-400 uppercase">
            {getPoliceRelationLabel(hoveredEdge.relationship_type)}
          </div>
          <div className="text-xs font-semibold mt-0.5">
            {hoveredEdge.source.name} ↔ {hoveredEdge.target.name}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Confidence: {Math.round((hoveredEdge.confidence_score || 0.8) * 100)}% (Evidence Verified)
          </div>
        </div>
      )}

      {/* Minimap (Bottom Right) */}
      <div className="absolute bottom-3 right-3 z-10 rounded-xl overflow-hidden border border-[var(--border-subtle)] shadow-xl bg-[rgba(15,23,42,0.85)] backdrop-blur-md">
        <canvas ref={minimapCanvasRef} width={140} height={90} className="block" />
        <div className="px-2 py-1 bg-slate-900/90 text-[9px] font-mono text-[var(--text-muted)] flex justify-between items-center border-t border-slate-800">
          <span>RADAR FRUSTUM</span>
          <span>{cameraDistance}m</span>
        </div>
      </div>

      {/* Clean Investigation Legend (Bottom Left) */}
      <div className="absolute bottom-3 left-3 z-10 bg-[rgba(15,23,42,0.9)] border border-[var(--border-subtle)] rounded-xl p-2.5 flex flex-wrap gap-x-3 gap-y-1.5 max-w-sm shadow-xl backdrop-blur-md">
        {Object.entries(ENTITY_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
            <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">
              {type.replace("_", " ")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
