'use strict';

import { Vec3, geometry } from 'cc';
const ray = geometry.Ray;
type ray = geometry.Ray;
const aabb = geometry.AABB;
type aabb = geometry.AABB;
const triangle = geometry.Triangle;
type triangle = geometry.Triangle;

const tempVec3_a = new Vec3();

// based on http://fileadmin.cs.lth.se/cs/Personal/Tomas_Akenine-Moller/raytri/
const ray_triangle = (function() {
    const ab = new Vec3(0, 0, 0);
    const ac = new Vec3(0, 0, 0);
    const pvec = new Vec3(0, 0, 0);
    const tvec = new Vec3(0, 0, 0);
    const qvec = new Vec3(0, 0, 0);

    return function(ray: ray, triangle: triangle, doubleSided = false, hitPos: Vec3) {
        Vec3.subtract(ab, triangle.b, triangle.a);
        Vec3.subtract(ac, triangle.c, triangle.a);

        Vec3.cross(pvec, ray.d, ac);
        const det = Vec3.dot(ab, pvec);
        if (det < Number.EPSILON && (!doubleSided || det > -Number.EPSILON)) {
            return 0;
        }

        const inv_det = 1 / det;

        Vec3.subtract(tvec, ray.o, triangle.a);
        const u = Vec3.dot(tvec, pvec) * inv_det;
        if (u < 0 || u > 1) {
            return 0;
        }

        Vec3.cross(qvec, tvec, ab);
        const v = Vec3.dot(ray.d, qvec) * inv_det;
        if (v < 0 || u + v > 1) {
            return 0;
        }

        const t = Vec3.dot(ac, qvec) * inv_det;

        if (t < 0) {
            return 0;
        } else {
            Vec3.scaleAndAdd(hitPos, ray.o, ray.d, t);
            return t;
        }
    };
})();

const ray_aabb = (function() {
    const min = new Vec3();
    const max = new Vec3();
    return function(ray: ray, aabb: aabb): number {
        const o = ray.o,
            d = ray.d;
        const ix = 1 / d.x,
            iy = 1 / d.y,
            iz = 1 / d.z;
        Vec3.subtract(min, aabb.center, aabb.halfExtents);
        Vec3.add(max, aabb.center, aabb.halfExtents);
        const t1 = (min.x - o.x) * ix;
        const t2 = (max.x - o.x) * ix;
        const t3 = (min.y - o.y) * iy;
        const t4 = (max.y - o.y) * iy;
        const t5 = (min.z - o.z) * iz;
        const t6 = (max.z - o.z) * iz;
        const tmin = Math.max(Math.max(Math.min(t1, t2), Math.min(t3, t4)), Math.min(t5, t6));
        const tmax = Math.min(Math.min(Math.max(t1, t2), Math.max(t3, t4)), Math.max(t5, t6));
        if (tmax < 0 || tmin > tmax) {
            return 0;
        }
        return tmin > 0 ? tmin : tmax;
    };
})();

// based on https://www.geometrictools.com/GTE/Mathematics/DistRaySegment.h
const ray_segment = (function() {
    const segCenter = new Vec3();
    const segDir = new Vec3();
    const diff = new Vec3();
    const pointOnSegment = new Vec3();

    return function(ray: ray, v0: Vec3, v1: Vec3, precision = 2, hitPos: Vec3) {
        const precisionSqr = precision * precision;
        Vec3.add(tempVec3_a, v0, v1);
        Vec3.multiplyScalar(segCenter, tempVec3_a, 0.5);
        Vec3.subtract(tempVec3_a, v1, v0);
        Vec3.normalize(segDir, tempVec3_a);
        Vec3.subtract(diff, ray.o, segCenter);

        const segExtent = Vec3.distance(v0, v1) * 0.5;
        const a01 = -ray.d.dot(segDir);
        const b0 = diff.dot(ray.d);
        const b1 = -diff.dot(segDir);
        const c = diff.lengthSqr();
        const det = Math.abs(1 - a01 * a01);
        let s0, s1, sqrDist, extDet;

        if (det > 0) {
            s0 = a01 * b1 - b0;
            s1 = a01 * b0 - b1;
            extDet = segExtent * det;

            if (s0 >= 0) {
                if (s1 >= -extDet) {
                    if (s1 <= extDet) {
                        const invDet = 1 / det;
                        s0 *= invDet;
                        s1 *= invDet;
                        sqrDist = s0 * (s0 + a01 * s1 + 2 * b0) + s1 * (a01 * s0 + s1 + 2 * b1) + c;
                    } else {
                        s1 = segExtent;
                        s0 = Math.max(0, -(a01 * s1 + b0));
                        sqrDist = -s0 * s0 + s1 * (s1 + 2 * b1) + c;
                    }
                } else {
                    s1 = -segExtent;
                    s0 = Math.max(0, -(a01 * s1 + b0));
                    sqrDist = -s0 * s0 + s1 * (s1 + 2 * b1) + c;
                }
            } else {
                if (s1 <= -extDet) {
                    s0 = Math.max(0, -(-a01 * segExtent + b0));
                    s1 = s0 > 0 ? -segExtent : Math.min(Math.max(-segExtent, -b1), segExtent);
                    sqrDist = -s0 * s0 + s1 * (s1 + 2 * b1) + c;
                } else if (s1 <= extDet) {
                    s0 = 0;
                    s1 = Math.min(Math.max(-segExtent, -b1), segExtent);
                    sqrDist = s1 * (s1 + 2 * b1) + c;
                } else {
                    s0 = Math.max(0, -(a01 * segExtent + b0));
                    s1 = s0 > 0 ? segExtent : Math.min(Math.max(-segExtent, -b1), segExtent);
                    sqrDist = -s0 * s0 + s1 * (s1 + 2 * b1) + c;
                }
            }
        } else {
            s1 = a01 > 0 ? -segExtent : segExtent;
            s0 = Math.max(0, -(a01 * s1 + b0));
            sqrDist = -s0 * s0 + s1 * (s1 + 2 * b1) + c;
        }

        if (pointOnSegment) {
            Vec3.scaleAndAdd(pointOnSegment, segCenter, segDir, s1);
        }

        if (hitPos) {
            hitPos.set(pointOnSegment);
        }

        let dist = 0;
        if (sqrDist < precisionSqr) {
            dist = Vec3.distance(ray.o, pointOnSegment);
        }

        return dist;
    };
})();

const intersect = {
    ray_triangle,
    ray_aabb,
    ray_segment,
};

export default intersect;
