'use strict';

import { gfx, IVec3Like, Mat4, Quat, Vec2, Vec3 } from 'cc';
import type { IMeshPrimitive } from './defines';

const EPSILON = 1e-6;
const TWO_PI = Math.PI * 2;
const HALF_PI = Math.PI / 2;
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

const PrimitiveMode = gfx.PrimitiveMode;
const v3_forward = new Vec3(0, 0, 1);
const tempVec3 = new Vec3();
const tempVec3_a = new Vec3();
const tempVec3_b = new Vec3();
const tempQuat_a = new Quat();

function deg2rad(deg: number): number {
    return deg * D2R;
}

class ControllerShape {
    public calcCylinderData(radiusTop = 0.5, radiusBottom = 0.5, height = 2, opts: any = {}) {
        const halfHeight = height * 0.5;
        const radialSegments = opts.radialSegments || 16;
        const heightSegments = opts.heightSegments || 1;
        const capped = opts.capped !== undefined ? opts.capped : true;
        const arc = opts.arc || 2.0 * Math.PI;

        let cntCap = 0;
        if (!capped) {
            if (radiusTop > 0) {
                cntCap++;
            }

            if (radiusBottom > 0) {
                cntCap++;
            }
        }

        // calculate vertex count
        let vertCount = (radialSegments + 1) * (heightSegments + 1);
        if (capped) {
            vertCount += (radialSegments + 1) * cntCap + radialSegments * cntCap;
        }

        // calculate index count
        let indexCount = radialSegments * heightSegments * 2 * 3;
        if (capped) {
            indexCount += radialSegments * cntCap * 3;
        }

        const indices = new Array(indexCount);
        const positions = new Array(vertCount);
        const normals = new Array(vertCount);
        const uvs = new Array(vertCount);
        const maxRadius = Math.max(radiusTop, radiusBottom);
        const minPos = new Vec3(-maxRadius, -halfHeight, -maxRadius);
        const maxPos = new Vec3(maxRadius, halfHeight, maxRadius);

        let index = 0;
        let indexOffset = 0;

        generateTorso();

        if (capped) {
            if (radiusBottom > 0) {
                generateCap(false);
            }

            if (radiusTop > 0) {
                generateCap(true);
            }
        }

        // =======================
        // internal functions
        // =======================

        function generateTorso() {
            const indexArray: number[][] = [];

            // this will be used to calculate the normal
            const slope = (radiusTop - radiusBottom) / height;

            // generate positions, normals and uvs
            for (let y = 0; y <= heightSegments; y++) {
                const indexRow: number[] = [];
                const v = y / heightSegments;

                // calculate the radius of the current row
                const radius = v * (radiusTop - radiusBottom) + radiusBottom;

                for (let x = 0; x <= radialSegments; ++x) {
                    const u = x / radialSegments;
                    const theta = u * arc;

                    const sinTheta = Math.sin(theta);
                    const cosTheta = Math.cos(theta);

                    // vertex
                    positions[index] = new Vec3(radius * sinTheta, v * height - halfHeight, radius * cosTheta);

                    // normal
                    normals[index] = new Vec3(sinTheta, -slope, cosTheta);
                    normals[index].normalize();

                    // uv
                    uvs[index] = new Vec2(((1 - u) * 2) % 1, v);

                    // save index of vertex in respective row
                    indexRow.push(index);

                    // increase index
                    ++index;
                }

                // now save positions of the row in our index array
                indexArray.push(indexRow);
            }

            // generate indices
            for (let y = 0; y < heightSegments; ++y) {
                for (let x = 0; x < radialSegments; ++x) {
                    // we use the index array to access the correct indices
                    const i1 = indexArray[y][x];
                    const i2 = indexArray[y + 1][x];
                    const i3 = indexArray[y + 1][x + 1];
                    const i4 = indexArray[y][x + 1];

                    // face one
                    indices[indexOffset] = i1;
                    ++indexOffset;
                    indices[indexOffset] = i4;
                    ++indexOffset;
                    indices[indexOffset] = i2;
                    ++indexOffset;

                    // face two
                    indices[indexOffset] = i4;
                    ++indexOffset;
                    indices[indexOffset] = i3;
                    ++indexOffset;
                    indices[indexOffset] = i2;
                    ++indexOffset;
                }
            }
        }

        function generateCap(top: boolean) {
            const radius = top ? radiusTop : radiusBottom;
            const sign = top ? 1 : -1;

            // save the index of the first center vertex
            const centerIndexStart = index;

            for (let x = 1; x <= radialSegments; ++x) {
                // vertex
                positions[index] = new Vec3(0, halfHeight * sign, 0);

                // normal
                normals[index] = new Vec3(0, sign, 0);

                // uv
                uvs[index] = new Vec2(0.5, 0.5);

                // increase index
                ++index;
            }

            // save the index of the last center vertex
            const centerIndexEnd = index;

            for (let x = 0; x <= radialSegments; ++x) {
                const u = x / radialSegments;
                const theta = u * arc;

                const cosTheta = Math.cos(theta);
                const sinTheta = Math.sin(theta);

                // vertex
                positions[index] = new Vec3(radius * sinTheta, halfHeight * sign, radius * cosTheta);

                // normal
                normals[index] = new Vec3(0, sign, 0);

                // uv
                uvs[index] = new Vec2(0.5 - sinTheta * 0.5 * sign, 0.5 + cosTheta * 0.5);

                // increase index
                ++index;
            }

            // generate indices
            for (let x = 0; x < radialSegments; ++x) {
                const c = centerIndexStart + x;
                const i = centerIndexEnd + x;

                if (top) {
                    // face top
                    indices[indexOffset] = i + 1;
                    ++indexOffset;
                    indices[indexOffset] = c;
                    ++indexOffset;
                    indices[indexOffset] = i;
                    ++indexOffset;
                } else {
                    // face bottom
                    indices[indexOffset] = c;
                    ++indexOffset;
                    indices[indexOffset] = i + 1;
                    ++indexOffset;
                    indices[indexOffset] = i;
                    ++indexOffset;
                }
            }
        }

        return {
            positions,
            normals,
            uvs,
            indices,
            minPos,
            maxPos,
        };
    }

    public calcConeData(radius: number, height: number, opts: any = {}) {
        return this.calcCylinderData(0, radius, height, opts);
    }

    /**
     * 生成 MeshRenderer 所需要的 position 数据
     */
    public calcPositionData(center: Readonly<Vec3>, width: number, height: number, normal: Readonly<Vec3> = new Vec3(0, 0, 1), needBoundingBox = true) {
        const hw = width / 2;
        const hh = height / 2;
        const points = [];
        const rot = tempQuat_a;
        Quat.rotationTo(rot, v3_forward, normal);
        points[0] = center.clone();
        points[0].add(Vec3.transformQuat(tempVec3, new Vec3(-hw, hh, 0), rot));
        points[1] = center.clone();
        points[1].add(Vec3.transformQuat(tempVec3, new Vec3(-hw, -hh, 0), rot));
        points[2] = center.clone();
        points[2].add(Vec3.transformQuat(tempVec3, new Vec3(hw, -hh, 0), rot));
        points[3] = center.clone();
        points[3].add(Vec3.transformQuat(tempVec3, new Vec3(hw, hh, 0), rot));

        let minPos, maxPos;

        if (needBoundingBox) {
            minPos = center.clone();
            minPos.add(Vec3.transformQuat(tempVec3, new Vec3(-hw, -hh, -0.01), rot));
            maxPos = center.clone();
            maxPos.add(Vec3.transformQuat(tempVec3, new Vec3(hw, hh, 0.01), rot));
        }
        return {
            positions: points,
            minPos: minPos,
            maxPos: maxPos,
        };
    }

    public calcQuadData(center: Readonly<Vec3>, width: number, height: number, normal: Readonly<Vec3> = new Vec3(0, 0, 1), needBoundingBox = true) {
        const indices = [0, 3, 1, 3, 2, 1];
        const uvs = [new Vec2(0, 1), new Vec2(0, 0), new Vec2(1, 0), new Vec2(1, 1)];
        const { positions, minPos, maxPos } = this.calcPositionData(center, width, height, normal, needBoundingBox);

        return {
            positions,
            normals: Array(4).fill(normal),
            indices,
            minPos,
            maxPos,
            uvs,
            doubleSided: true,
        };
    }

    public lineWithBoundingBox(length: number, size = 3) {
        return {
            positions: [new Vec3(), new Vec3(length, 0, 0)],
            normals: Array(2).fill(new Vec3(0, 1, 0)),
            indices: [0, 1],
            minPos: new Vec3(0, -size, -size),
            maxPos: new Vec3(length, size, size),
            primitiveType: PrimitiveMode.LINE_LIST,
        };
    }

    public calcCubeData(width: number, height: number, length: number, center?: IVec3Like, opts: any = {}) {
        const ws = opts.widthSegments ? opts.widthSegments : 1;
        const hs = opts.heightSegments ? opts.heightSegments : 1;
        const ls = opts.lengthSegments ? opts.lengthSegments : 1;

        const hw = width * 0.5;
        const hh = height * 0.5;
        const hl = length * 0.5;

        const corners = [
            new Vec3(-hw, -hh, hl),
            new Vec3(hw, -hh, hl),
            new Vec3(hw, hh, hl),
            new Vec3(-hw, hh, hl),
            new Vec3(hw, -hh, -hl),
            new Vec3(-hw, -hh, -hl),
            new Vec3(-hw, hh, -hl),
            new Vec3(hw, hh, -hl),
        ];

        const faceAxis = [
            [2, 3, 1], // FRONT
            [4, 5, 7], // BACK
            [7, 6, 2], // TOP
            [1, 0, 4], // BOTTOM
            [1, 4, 2], // RIGHT
            [5, 0, 6], // LEFT
        ];

        const faceNormals = [
            new Vec3(0, 0, 1), // FRONT
            new Vec3(0, 0, -1), // BACK
            new Vec3(0, 1, 0), // TOP
            new Vec3(0, -1, 0), // BOTTOM
            new Vec3(1, 0, 0), // RIGHT
            new Vec3(-1, 0, 0), // LEFT
        ];

        const positions: Vec3[] = [];
        const normals: Vec3[] = [];
        const uvs: Vec2[] = [];
        const indices: number[] = [];
        const minPos = new Vec3(-hw, -hh, -hl);
        const maxPos = new Vec3(hw, hh, hl);

        function _buildPlane(side: number, uSegments: number, vSegments: number) {
            let u;
            let v;
            let ix;
            let iy;
            const offset = positions.length;
            const idx = faceAxis[side];
            const faceNormal = faceNormals[side];

            const t1 = tempVec3_a;
            const t2 = tempVec3_b;
            for (iy = 0; iy <= vSegments; iy++) {
                for (ix = 0; ix <= uSegments; ix++) {
                    u = ix / uSegments;
                    v = iy / vSegments;

                    Vec3.lerp(t1, corners[idx[0]], corners[idx[1]], u);
                    Vec3.lerp(t2, corners[idx[0]], corners[idx[2]], v);
                    t2.subtract(corners[idx[0]]);
                    const pos = new Vec3(t1);
                    const normal = faceNormal.clone();
                    pos.add(t2);
                    normals.push(normal);
                    if (center) {
                        Vec3.add(pos, center, pos);
                    }
                    positions.push(pos);
                    uvs.push(new Vec2(u, v));

                    if (ix < uSegments && iy < vSegments) {
                        const useg1 = uSegments + 1;
                        const a = ix + iy * useg1;
                        const b = ix + (iy + 1) * useg1;
                        const c = ix + 1 + (iy + 1) * useg1;
                        const d = ix + 1 + iy * useg1;

                        indices.push(offset + a, offset + d, offset + b);
                        indices.push(offset + b, offset + d, offset + c);
                    }
                }
            }
        }

        _buildPlane(0, ws, hs); // FRONT
        _buildPlane(4, ls, hs); // RIGHT
        _buildPlane(1, ws, hs); // BACK
        _buildPlane(5, ls, hs); // LEFT
        _buildPlane(3, ws, ls); // BOTTOM
        _buildPlane(2, ws, ls); // TOP

        return {
            positions,
            indices,
            normals,
            minPos,
            maxPos,
        };
    }

    public torus(radius: number, tube: number, opts: any = {}) {
        const radialSegments = opts.radialSegments || 30;
        const tubularSegments = opts.tubularSegments || 20;
        const arc = opts.arc || 2.0 * Math.PI;

        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];
        const minPos = new Vec3(-radius - tube, -tube, -radius - tube);
        const maxPos = new Vec3(radius + tube, tube, radius + tube);

        for (let j = 0; j <= radialSegments; j++) {
            for (let i = 0; i <= tubularSegments; i++) {
                const u = i / tubularSegments;
                const v = j / radialSegments;

                const u1 = u * arc;
                const v1 = v * Math.PI * 2;

                // vertex
                const x = (radius + tube * Math.cos(v1)) * Math.sin(u1);
                const y = tube * Math.sin(v1);
                const z = (radius + tube * Math.cos(v1)) * Math.cos(u1);

                // this vector is used to calculate the normal
                const nx = Math.sin(u1) * Math.cos(v1);
                const ny = Math.sin(v1);
                const nz = Math.cos(u1) * Math.cos(v1);

                positions.push(new Vec3(x, y, z));
                normals.push(new Vec3(nx, ny, nz));
                uvs.push(new Vec2(u, v));

                if (i < tubularSegments && j < radialSegments) {
                    const seg1 = tubularSegments + 1;
                    const a = seg1 * j + i;
                    const b = seg1 * (j + 1) + i;
                    const c = seg1 * (j + 1) + i + 1;
                    const d = seg1 * j + i + 1;

                    indices.push(a, d, b);
                    indices.push(d, c, b);
                }
            }
        }

        return {
            positions,
            indices,
            normals,
            uvs,
            minPos,
            maxPos,
        };
    }

    public calcArcPoints(center: Readonly<Vec3>, normal: Readonly<Vec3>, fromDir: Readonly<Vec3>, radian: number, radius: number, segments = 60) {
        Vec3.normalize(tempVec3_a, fromDir);
        Vec3.normalize(tempVec3_b, normal);
        const deltaRot = tempQuat_a;
        const count = segments;
        Quat.fromAxisAngle(deltaRot, tempVec3_b, radian / (count - 1));
        const tangent = tempVec3;
        Vec3.multiplyScalar(tangent, tempVec3_a, radius);

        const arcPoints = [];
        for (let i = 0; i < count; i++) {
            arcPoints[i] = center.clone();
            arcPoints[i].add(tangent);
            Vec3.transformQuat(tangent, tangent, deltaRot);
        }

        return arcPoints;
    }

    public getBiNormalByNormal(normal: Readonly<Vec3>) {
        const biNormal = new Vec3();
        Vec3.cross(biNormal, normal, new Vec3(0, 1, 0));
        if (Vec3.lengthSqr(biNormal) < 0.001) {
            Vec3.cross(biNormal, normal, new Vec3(1, 0, 0));
        }

        return biNormal;
    }

    public calcCirclePoints(center: Readonly<Vec3>, normal: Readonly<Vec3>, radius: number, segments = 60) {
        const biNormal = this.getBiNormalByNormal(normal);

        return this.calcArcPoints(center, normal, biNormal, TWO_PI, radius, segments);
    }

    public calcDiscPoints(center: Readonly<Vec3>, normal: Readonly<Vec3>, radius: number, segments = 60) {
        const biNormal = this.getBiNormalByNormal(normal);

        return this.calcSectorPoints(center, normal, biNormal, TWO_PI, radius, segments);
    }

    public calcSectorPoints(center: Readonly<Vec3>, normal: Readonly<Vec3>, fromDir: Readonly<Vec3>, radian: number, radius: number, segments: number) {
        let sectorPoints: Vec3[] = [];
        sectorPoints.push(center as Vec3);
        const arcPoints = this.calcArcPoints(center, normal, fromDir, radian, radius, segments);
        sectorPoints = sectorPoints.concat(arcPoints);
        return sectorPoints;
    }

    public indicesFanToList(fanIndices: number[]) {
        const listIndices = Array((fanIndices.length - 2) * 3).fill(0);
        for (let i = 1; i < fanIndices.length - 1; i++) {
            listIndices[(i - 1) * 3] = 0;
            listIndices[(i - 1) * 3 + 1] = i;
            listIndices[(i - 1) * 3 + 2] = i + 1;
        }
        return listIndices;
    }

    // 扇形
    public calcSectorData(center: Readonly<Vec3>, normal: Readonly<Vec3>, fromDir: Readonly<Vec3>, radian: number, radius: number, segments: number) {
        return {
            positions: this.calcSectorPoints(center, normal, fromDir, radian, radius, segments),
            normals: Array(segments + 1).fill(normal.clone()),
            indices: this.indicesFanToList([...Array(segments + 1).keys()]),
            primitiveType: PrimitiveMode.TRIANGLE_LIST,
        };
    }

    public arcDirectionLine(center: Vec3, normal: Vec3, fromDir: Vec3, radian: number, radius: number, length: number, segments: number) {
        const vertices: Vec3[] = [];
        const indices: number[] = [];

        // add direction line
        const arcPoints = this.calcArcPoints(center, normal, fromDir, radian, radius, segments);
        const endOffset = new Vec3();
        Vec3.multiplyScalar(endOffset, normal, length);
        for (let i = 0; i < arcPoints.length; i++) {
            const endPoint = new Vec3();
            Vec3.add(endPoint, arcPoints[i], endOffset);
            vertices.push(arcPoints[i], endPoint);
            indices.push(i * 2, i * 2 + 1);
        }

        // add arc
        for (let i = 1; i < arcPoints.length; i++) {
            vertices.push(arcPoints[i - 1]);
            indices.push(vertices.length - 1);
            vertices.push(arcPoints[i]);
            indices.push(vertices.length - 1);
        }

        return {
            positions: vertices,
            normals: Array(vertices.length).fill(new Vec3(0, 1, 1)),
            indices,
            primitiveType: PrimitiveMode.LINE_LIST,
        };
    }

    public calcBoxPoints(center: Vec3, size: Vec3) {
        const halfSize = new Vec3();
        Vec3.multiplyScalar(halfSize, size, 0.5);
        const points = [];

        points[0] = new Vec3(center);
        points[0].add(new Vec3(-halfSize.x, -halfSize.y, -halfSize.z));
        points[1] = new Vec3(center);
        points[1].add(new Vec3(-halfSize.x, halfSize.y, -halfSize.z));
        points[2] = new Vec3(center);
        points[2].add(new Vec3(halfSize.x, halfSize.y, -halfSize.z));
        points[3] = new Vec3(center);
        points[3].add(new Vec3(halfSize.x, -halfSize.y, -halfSize.z));
        points[4] = new Vec3(center);
        points[4].add(new Vec3(-halfSize.x, -halfSize.y, halfSize.z));
        points[5] = new Vec3(center);
        points[5].add(new Vec3(-halfSize.x, halfSize.y, halfSize.z));
        points[6] = new Vec3(center);
        points[6].add(new Vec3(halfSize.x, halfSize.y, halfSize.z));
        points[7] = new Vec3(center);
        points[7].add(new Vec3(halfSize.x, -halfSize.y, halfSize.z));

        return points;
    }

    public wireframeBox(center: Vec3, size: Vec3) {
        const points = this.calcBoxPoints(center, size);
        const indices = [];

        for (let i = 1; i < 4; i++) {
            indices.push(i - 1, i);
        }
        indices.push(0, 3);

        for (let i = 5; i < 8; i++) {
            indices.push(i - 1, i);
        }
        indices.push(4, 7);

        for (let i = 0; i < 4; i++) {
            indices.push(i, i + 4);
        }

        return {
            positions: points,
            normals: Array(points.length).fill(new Vec3(0, 1, 0)),
            indices,
            primitiveType: PrimitiveMode.LINE_LIST,
        };
    }

    public calcFrustum(isOrtho: boolean, orthoHeight: number, fov: number, aspect: number, near: number, far: number, isFOVY: boolean) {
        const points = [];
        const indices = [];
        let nearHalfHeight;
        let nearHalfWidth;
        let farHalfHeight;
        let farHalfWidth;

        if (isOrtho) {
            nearHalfHeight = farHalfHeight = orthoHeight;
            nearHalfWidth = farHalfWidth = nearHalfHeight * aspect;
        } else {
            if (isFOVY) {
                nearHalfHeight = Math.tan(deg2rad(fov / 2)) * near;
                nearHalfWidth = nearHalfHeight * aspect;

                farHalfHeight = Math.tan(deg2rad(fov / 2)) * far;
                farHalfWidth = farHalfHeight * aspect;
            } else {
                nearHalfWidth = Math.tan(deg2rad(fov / 2)) * near;
                nearHalfHeight = nearHalfWidth / aspect;

                farHalfWidth = Math.tan(deg2rad(fov / 2)) * far;
                farHalfHeight = farHalfWidth / aspect;
            }
        }

        points[0] = new Vec3(-nearHalfWidth, -nearHalfHeight, -near);
        points[1] = new Vec3(-nearHalfWidth, nearHalfHeight, -near);
        points[2] = new Vec3(nearHalfWidth, nearHalfHeight, -near);
        points[3] = new Vec3(nearHalfWidth, -nearHalfHeight, -near);

        points[4] = new Vec3(-farHalfWidth, -farHalfHeight, -far);
        points[5] = new Vec3(-farHalfWidth, farHalfHeight, -far);
        points[6] = new Vec3(farHalfWidth, farHalfHeight, -far);
        points[7] = new Vec3(farHalfWidth, -farHalfHeight, -far);

        for (let i = 1; i < 4; i++) {
            indices.push(i - 1, i);
        }
        indices.push(0, 3);
        for (let i = 5; i < 8; i++) {
            indices.push(i - 1, i);
        }
        indices.push(4, 7);

        for (let i = 0; i < 4; i++) {
            indices.push(i, i + 4);
        }

        return {
            positions: points,
            indices,
            normals: Array(points.length).fill(new Vec3(0, 1, 0)),
            primitiveType: PrimitiveMode.LINE_LIST,
        };
    }

    public calcRectanglePoints(center: Readonly<Vec3>, rotation: Readonly<Quat>, size: any) {
        const right = new Vec3(size.x / 2, 0, 0);
        const up = new Vec3(0, size.y / 2, 0);
        Vec3.transformQuat(right, right, rotation);
        Vec3.transformQuat(up, up, rotation);

        const vertices = [];
        vertices[0] = center.clone();
        vertices[0].add(right);
        vertices[0].add(up);
        vertices[1] = center.clone();
        vertices[1].add(right);
        vertices[1].subtract(up);
        vertices[2] = center.clone();
        vertices[2].subtract(right);
        vertices[2].subtract(up);
        vertices[3] = center.clone();
        vertices[3].subtract(right);
        vertices[3].add(up);

        const indices = [];
        for (let i = 1; i < 4; i++) {
            indices.push(i - 1, i);
        }
        indices.push(0, 3);

        return { vertices, indices };
    }

    public calcRectangleData(center: Readonly<Vec3>, rotation: Readonly<Quat>, size: any) {
        const rectData = this.calcRectanglePoints(center, rotation, size);
        return {
            positions: rectData.vertices,
            normals: Array(rectData.vertices.length).fill(new Vec3(0, 1, 0)),
            indices: rectData.indices,
            primitiveType: PrimitiveMode.LINE_LIST,
        };
    }

    public calcSphereData(center: Readonly<Vec3>, radius = 0.5, opts: any = {}): IMeshPrimitive {
        const segments = opts.segments !== undefined ? opts.segments : 32;

        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];
        const minPos = new Vec3(-radius, -radius, -radius);
        const maxPos = new Vec3(radius, radius, radius);
        const boundingRadius = radius;

        for (let lat = 0; lat <= segments; ++lat) {
            const theta = (lat * Math.PI) / segments;
            const sinTheta = Math.sin(theta);
            const cosTheta = -Math.cos(theta);

            for (let lon = 0; lon <= segments; ++lon) {
                const phi = (lon * 2 * Math.PI) / segments - Math.PI / 2.0;
                const sinPhi = Math.sin(phi);
                const cosPhi = Math.cos(phi);

                const x = sinPhi * sinTheta;
                const y = cosTheta;
                const z = cosPhi * sinTheta;
                const u = lon / segments;
                const v = lat / segments;

                positions.push(new Vec3(center.x + x * radius, center.y + y * radius, center.z + z * radius));
                normals.push(new Vec3(x, y, z));
                uvs.push(new Vec2(u, v));

                if (lat < segments && lon < segments) {
                    const seg1 = segments + 1;
                    const a = seg1 * lat + lon;
                    const b = seg1 * (lat + 1) + lon;
                    const c = seg1 * (lat + 1) + lon + 1;
                    const d = seg1 * lat + lon + 1;

                    indices.push(a, d, b);
                    indices.push(d, c, b);
                }
            }
        }

        return {
            positions,
            indices,
            normals,
            uvs,
            minPos,
            maxPos,
            boundingRadius,
        };
    }

    // calculate shape data
    public calcArcData(center: Readonly<Vec3>, normal: Readonly<Vec3>, fromDir: Readonly<Vec3>, radian: number, radius: number, segments = 60) {
        Vec3.normalize(tempVec3_a, fromDir);
        Vec3.normalize(tempVec3_b, normal);
        const deltaRot = tempQuat_a;
        const count = segments;
        Quat.fromAxisAngle(deltaRot, tempVec3_b, radian / (count - 1));
        const tangent = new Vec3();
        Vec3.multiplyScalar(tangent, tempVec3_a, radius);

        const arcPoints = [];
        for (let i = 0; i < count; i++) {
            arcPoints[i] = center.clone();
            arcPoints[i].add(tangent);
            Vec3.transformQuat(tangent, tangent, deltaRot);
        }

        return {
            positions: arcPoints,
            normals: Array(segments).fill(new Vec3(tempVec3_b)),
            indices: [...Array(segments).keys()],
            primitiveType: PrimitiveMode.LINE_STRIP,
        };
    }

    public calcCircleData(center: Readonly<Vec3>, normal: Readonly<Vec3>, radius: number, segments = 60) {
        const biNormal = this.getBiNormalByNormal(normal);

        return this.calcArcData(center, normal, biNormal, TWO_PI, radius, segments);
    }

    public calcLinesData(vertices: Vec3[], indices: number[], needBoundingBoxData = true): IMeshPrimitive {
        const lineData: IMeshPrimitive = {
            positions: vertices,
            normals: Array(vertices.length).fill(new Vec3(0, 1, 0)),
            indices,
            primitiveType: PrimitiveMode.LINE_LIST,
        };

        if (needBoundingBoxData) {
            const minPos = new Vec3();
            const maxPos = new Vec3();

            if (vertices.length > 0) {
                minPos.set(vertices[0]);
                maxPos.set(vertices[0]);
                for (let i = 1; i < vertices.length; i++) {
                    Vec3.min(minPos, minPos, vertices[i]);
                    Vec3.max(maxPos, maxPos, vertices[i]);
                }
            }

            lineData.minPos = minPos;
            lineData.maxPos = maxPos;
        }

        return lineData;
    }

    public calcDiscData(center: Readonly<Vec3>, normal: Readonly<Vec3>, radius: number, segments = 60) {
        const biNormal = this.getBiNormalByNormal(normal);

        const maxPos = new Vec3(radius, radius, 0);
        const minPos = new Vec3(-radius, -radius, 0);
        Quat.rotationTo(tempQuat_a, Vec3.UNIT_Z, normal);
        Vec3.add(maxPos, maxPos, center);
        Vec3.transformQuat(maxPos, maxPos, tempQuat_a);
        Vec3.add(minPos, minPos, center);
        Vec3.transformQuat(minPos, minPos, tempQuat_a);
        return {
            positions: this.calcSectorPoints(center, normal, biNormal, TWO_PI, radius, segments),
            normals: Array(segments + 1).fill(normal.clone()),
            indices: this.indicesFanToList([...Array(segments + 1).keys()]),
            primitiveType: PrimitiveMode.TRIANGLE_LIST,
            minPos,
            maxPos,
        };
    }

    public calcLineData(startPos: Vec3, endPos: Vec3) {
        const minPos = new Vec3();
        const maxPos = new Vec3();
        Vec3.min(minPos, startPos, endPos);
        Vec3.max(maxPos, startPos, endPos);

        Vec3.subtract(tempVec3, maxPos, minPos);
        const parts: string[] = [];
        // 和轴平行的线需要一个不为0的包围盒
        const xyz = ['x', 'y', 'z'];
        xyz.forEach((part) => {
            // @ts-expect-error
            if (tempVec3[part] === 0) {
                parts.push(part);
            }
        });

        if (parts.length === 2) {
            parts.forEach((part) => {
                // @ts-expect-error
                minPos[part] -= 0.5;
                // @ts-expect-error
                maxPos[part] += 0.5;
            });
        }

        return {
            positions: [new Vec3(startPos.x, startPos.y, startPos.z), new Vec3(endPos.x, endPos.y, endPos.z)],
            normals: Array(2).fill(new Vec3(0, 1, 0)),
            indices: [0, 1],
            minPos,
            maxPos,
            primitiveType: PrimitiveMode.LINE_LIST,
        };
    }

    public calcPolygonData(points: Vec3[], indices?: number[]) {
        const minPos = new Vec3();
        const maxPos = new Vec3();
        points.forEach((point) => {
            Vec3.min(minPos, minPos, point);
            Vec3.max(maxPos, maxPos, point);
        });

        let finalIndices;
        if (indices) {
            finalIndices = indices;
        } else {
            finalIndices = [...points.keys()];
        }

        return {
            positions: points,
            normals: Array(points.length).fill(new Vec3(0, 1, 0)),
            indices: finalIndices,
            minPos,
            maxPos,
            primitiveType: PrimitiveMode.TRIANGLE_LIST,
        };
    }

    /**
     * calculate the data of octahedron
     * https://en.wikipedia.org/wiki/Octahedron
     * @param lowerPoint The lower apex's position.
     * @param upperPoint The upper apex's position.
     * @param width The width of the polygonal base
     * @param length The length of the polygonal base
     * @param ratio The height ratio of the downside pyramid. Usually in interval [0, 1].
     */
    public calcOctahedronData(lowerPoint: IVec3Like, upperPoint: IVec3Like, width: number, length: number, ratio = 0.2) {
        const halfWidth = width / 2.0;
        const halfLength = length / 2.0;
        const minPos = new Vec3();
        const maxPos = new Vec3();

        const positions: Vec3[] = [
            new Vec3(0.0, 0.0, 0.0), // lowerApex
            new Vec3(0.0, 1.0, 0.0), // upperApex
            new Vec3(halfWidth, ratio, halfLength), // v0
            new Vec3(-halfWidth, ratio, halfLength), // v1
            new Vec3(-halfWidth, ratio, -halfLength), // v2
            new Vec3(halfWidth, ratio, -halfLength), // v3
        ];

        const dir = Vec3.subtract(new Vec3(), upperPoint, lowerPoint);
        const dirLen = Vec3.len(dir);
        Vec3.normalize(dir, dir);
        const rot = Quat.rotationTo(new Quat(), Vec3.UNIT_Y, dir);
        const transform = Mat4.fromRTS(new Mat4(), rot, lowerPoint, new Vec3(dirLen, dirLen, dirLen));
        for (let i = 0; i < positions.length; ++i) {
            const p = positions[i];
            Vec3.transformMat4(p, p, transform);

            Vec3.min(minPos, minPos, p);
            Vec3.max(maxPos, maxPos, p);
        }

        const lowerApex = 0;
        const upperApex = 1;
        const v0 = 2;
        const v1 = 3;
        const v2 = 4;
        const v3 = 5;

        const faceVertices: number[] = [
            v0, v1, lowerApex,
            v1, v2, lowerApex,
            v2, v3, lowerApex,
            v3, v0, lowerApex,
            upperApex, v1, v0,
            upperApex, v2, v1,
            upperApex, v3, v2,
            upperApex, v0, v3,
        ];

        const nFaceVertices = faceVertices.length;
        const vertices: number[] = new Array(3 * nFaceVertices).fill(0.0);
        for (let iFaceVertex = 0; iFaceVertex < nFaceVertices; ++iFaceVertex) {
            const positionIndex = faceVertices[iFaceVertex];
            vertices[3 * iFaceVertex] = positions[positionIndex].x;
            vertices[3 * iFaceVertex + 1] = positions[positionIndex].y;
            vertices[3 * iFaceVertex + 2] = positions[positionIndex].z;
        }

        // 简化版法线计算（不依赖 External.GeometryUtils.calculateNormals）
        const normals = calculateTriangleNormals(vertices, nFaceVertices);

        const vec3Normals: Vec3[] = [];
        for (let i = 0; i < normals.length; i += 3) {
            vec3Normals.push(new Vec3(normals[i], normals[i + 1], normals[i + 2]));
        }

        const vec3Positions: Vec3[] = faceVertices.map((index) => positions[index]);
        const indices = [...Array(vec3Positions.length).keys()];

        return {
            primitiveType: PrimitiveMode.TRIANGLE_LIST,
            positions: vec3Positions,
            normals: vec3Normals,
            indices,
            minPos,
            maxPos,
        };
    }
}

/**
 * 简化版三角形法线计算
 */
function calculateTriangleNormals(vertices: number[], nFaceVertices: number): number[] {
    const normals = new Array(vertices.length).fill(0.0);
    const indices = Array.from({ length: nFaceVertices }, (_, i) => i);

    for (let i = 0; i < indices.length; i += 3) {
        const i0 = indices[i];
        const i1 = indices[i + 1];
        const i2 = indices[i + 2];

        const ax = vertices[i0 * 3], ay = vertices[i0 * 3 + 1], az = vertices[i0 * 3 + 2];
        const bx = vertices[i1 * 3], by = vertices[i1 * 3 + 1], bz = vertices[i1 * 3 + 2];
        const cx = vertices[i2 * 3], cy = vertices[i2 * 3 + 1], cz = vertices[i2 * 3 + 2];

        const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
        const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;

        const nx = e1y * e2z - e1z * e2y;
        const ny = e1z * e2x - e1x * e2z;
        const nz = e1x * e2y - e1y * e2x;

        for (const idx of [i0, i1, i2]) {
            normals[idx * 3] += nx;
            normals[idx * 3 + 1] += ny;
            normals[idx * 3 + 2] += nz;
        }
    }

    // normalize
    for (let i = 0; i < normals.length; i += 3) {
        const len = Math.sqrt(normals[i] ** 2 + normals[i + 1] ** 2 + normals[i + 2] ** 2);
        if (len > EPSILON) {
            normals[i] /= len;
            normals[i + 1] /= len;
            normals[i + 2] /= len;
        }
    }

    return normals;
}

export default new ControllerShape();
