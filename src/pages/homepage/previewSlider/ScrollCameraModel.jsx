import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const lerp = (start, end, progress) => start + (end - start) * progress;

const getSectionProgress = (target) => {
  if (!target) {
    return 0;
  }

  const bounds = target.getBoundingClientRect();
  const viewportHeight = window.innerHeight || 1;
  const travel = viewportHeight + bounds.height;

  return clamp((viewportHeight - bounds.top) / travel);
};

const CameraObject = ({ sectionRef, reducedMotion }) => {
  const groupRef = useRef(null);
  const dragStateRef = useRef({
    isDragging: false,
    startX: 0,
    yaw: 0,
    targetYaw: 0,
    startYaw: 0,
  });
  const gltf = useLoader(GLTFLoader, "/models/camera.glb", (loader) => {
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    loader.setDRACOLoader(dracoLoader);
  });

  const { model, fitScale } = useMemo(() => {
    const clonedObject = gltf.scene.clone(true);

    clonedObject.traverse((child) => {
      if (!child.isMesh) {
        return;
      }

      child.castShadow = true;
      child.receiveShadow = true;

      if (child.material) {
        child.material = child.material.clone();
        child.material.side = THREE.DoubleSide;
        child.material.needsUpdate = true;
      }
    });

    const bounds = new THREE.Box3().setFromObject(clonedObject);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const maxAxis = Math.max(size.x, size.y, size.z) || 1;

    clonedObject.position.sub(center);

    return {
      model: clonedObject,
      fitScale: 2.9 / maxAxis,
    };
  }, [gltf.scene]);

  useEffect(() => {
    if (!groupRef.current) {
      return;
    }

    groupRef.current.rotation.set(-0.08, Math.PI, -0.08);
    groupRef.current.position.set(0, 0, 0.25);
  }, []);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) {
      return;
    }

    if (reducedMotion) {
      dragStateRef.current.yaw = THREE.MathUtils.damp(
        dragStateRef.current.yaw,
        dragStateRef.current.targetYaw,
        14,
        1 / 60
      );
      group.position.set(0, 0, 0.25);
      group.rotation.set(-0.08, 0.18 + dragStateRef.current.yaw, -0.04);
      return;
    }

    const progress = getSectionProgress(sectionRef.current);
    dragStateRef.current.yaw = THREE.MathUtils.damp(
      dragStateRef.current.yaw,
      dragStateRef.current.targetYaw,
      14,
      1 / 60
    );

    group.position.set(0, 0, 0.25);
    group.rotation.x = lerp(-0.08, 0.04, progress);
    group.rotation.y = lerp(Math.PI, 0, progress) + dragStateRef.current.yaw;
    group.rotation.z = lerp(-0.08, 0.08, progress);
  });

  const handlePointerDown = (event) => {
    event.stopPropagation();
    dragStateRef.current = {
      ...dragStateRef.current,
      isDragging: true,
      startX: event.clientX,
      startYaw: dragStateRef.current.yaw,
    };
    event.target.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!dragStateRef.current.isDragging) {
      return;
    }

    event.stopPropagation();
    const deltaX = event.clientX - dragStateRef.current.startX;
    dragStateRef.current.targetYaw = clamp(
      dragStateRef.current.startYaw + deltaX * 0.022,
      -Math.PI * 1.35,
      Math.PI * 1.35
    );
  };

  const handlePointerUp = (event) => {
    if (!dragStateRef.current.isDragging) {
      return;
    }

    event.stopPropagation();
    dragStateRef.current.isDragging = false;
    event.target.releasePointerCapture?.(event.pointerId);
  };

  return (
    <>
      <mesh
        position={[0, 0, 2.4]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <planeGeometry args={[18, 18]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <group
        ref={groupRef}
        scale={fitScale}
      >
        <primitive object={model} />
      </group>
    </>
  );
};

const CameraFallback = () => (
  <div className="preview-slider__camera-fallback" aria-hidden="true">
    <span />
    <span />
    <span />
  </div>
);

const ScrollCameraModel = ({ sectionRef }) => {
  const reducedMotion = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  return (
    <div className="preview-slider__camera-stage" aria-hidden="true">
      <Suspense fallback={<CameraFallback />}>
        <Canvas
          camera={{ position: [0, 0.1, 5.8], fov: 34 }}
          dpr={[1, 1.7]}
          gl={{ alpha: true, antialias: true }}
        >
          <ambientLight intensity={2.2} />
          <directionalLight position={[3, 4, 5]} intensity={2.8} />
          <directionalLight position={[-4, 2, -2]} intensity={1.35} color="#ce3824" />
          <spotLight position={[0, 4, 3]} angle={0.42} penumbra={0.8} intensity={2} />
          <CameraObject sectionRef={sectionRef} reducedMotion={reducedMotion} />
        </Canvas>
      </Suspense>
    </div>
  );
};

export default ScrollCameraModel;
