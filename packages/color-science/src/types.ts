// Color space type definitions

export interface RGB {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

export interface Lab {
  L: number; // 0-100
  a: number; // -128 to 127
  b: number; // -128 to 127
}

export interface XYZ {
  X: number;
  Y: number;
  Z: number;
}

export interface KMeansResult {
  centroid: Lab;
  clusterSizes: number[];
  allCentroids: Lab[];
  assignments: number[]; // cluster index each input pixel was assigned to
  dominantIndex: number; // index into allCentroids/clusterSizes of the dominant cluster
}
