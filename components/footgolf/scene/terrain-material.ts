import * as THREE from "three";

export interface TerrainTextureSet {
  fairway: THREE.Texture;
  rough: THREE.Texture;
  sand: THREE.Texture;
  green: THREE.Texture;
}

/**
 * A MeshStandardMaterial extended (via onBeforeCompile) to splat four tiled
 * ground textures together using per-vertex blend weights:
 *   vColor.r -> rough, vColor.g -> sand, vColor.b -> green, base -> fairway.
 * Keeping this as real PBR lighting (not an unlit shader) is what makes the
 * terrain read as "realistic" under the sun/shadow rig rather than flat.
 */
export function createTerrainMaterial(textures: TerrainTextureSet): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    map: textures.fairway,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.tRoughLayer = { value: textures.rough };
    shader.uniforms.tSandLayer = { value: textures.sand };
    shader.uniforms.tGreenLayer = { value: textures.green };

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform sampler2D tRoughLayer;
        uniform sampler2D tSandLayer;
        uniform sampler2D tGreenLayer;`
      )
      .replace(
        "#include <map_fragment>",
        `#ifdef USE_MAP
        vec3 baseColor = texture2D( map, vMapUv ).rgb;
        vec3 roughColor = texture2D( tRoughLayer, vMapUv ).rgb;
        vec3 sandColor = texture2D( tSandLayer, vMapUv ).rgb;
        vec3 greenColor = texture2D( tGreenLayer, vMapUv ).rgb;
        vec3 blended = mix( baseColor, roughColor, vColor.r );
        blended = mix( blended, sandColor, vColor.g );
        blended = mix( blended, greenColor, vColor.b );
        diffuseColor.rgb *= blended;
        #endif`
      )
      .replace("#include <color_fragment>", "// blend weights already consumed above, not an actual tint");
  };

  material.customProgramCacheKey = () => "footgolf-terrain-splat";

  return material;
}
