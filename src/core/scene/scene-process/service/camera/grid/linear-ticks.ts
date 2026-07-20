function clamp01(val: number): number {
    return Math.min(1, Math.max(0, val));
}

class LinearTicks {
    public ticks: number[] = [];
    public tickLods: number[] = [];
    public tickRatios: number[] = [];

    public minScale = 0.1;
    public maxScale = 1000.0;
    public minValueScale = 1.0;
    public maxValueScale = 1.0;
    public minValue = -500;
    public maxValue = 500;
    public pixelRange = 500;
    public minSpacing = 10;
    public maxSpacing = 80;
    public minTickLevel = 0;
    public maxTickLevel = 0;

    initTicks(lods: number[], min: number, max: number) {
        if (min <= 0) min = 1;
        if (max <= 0) max = 1;
        if (max < min) max = min;

        this.tickLods = lods;
        this.minScale = min;
        this.maxScale = max;
        this.ticks = [];

        let curTick = 1;
        let curlodIdx = 0;
        this.ticks.push(curTick);
        let maxTickValue = 1;
        let minTickValue = 1;

        while (curTick * this.tickLods[curlodIdx] <= max) {
            curTick = curTick * this.tickLods[curlodIdx];
            curlodIdx = curlodIdx + 1 > this.tickLods.length - 1 ? 0 : curlodIdx + 1;
            this.ticks.push(curTick);
            maxTickValue = curTick;
        }

        this.minValueScale = (1.0 / maxTickValue) * 100;

        curlodIdx = this.tickLods.length - 1;
        curTick = 1.0;
        while (curTick / this.tickLods[curlodIdx] >= min) {
            curTick = curTick / this.tickLods[curlodIdx];
            curlodIdx = curlodIdx - 1 < 0 ? this.tickLods.length - 1 : curlodIdx - 1;
            this.ticks.unshift(curTick);
            minTickValue = curTick;
        }

        this.maxValueScale = (1.0 / minTickValue) * 100;
        return this;
    }

    spacing(min: number, max: number) {
        this.minSpacing = min;
        this.maxSpacing = max;
        return this;
    }

    range(minValue: number, maxValue: number, range: number) {
        this.minValue = Math.fround(Math.min(minValue, maxValue));
        this.maxValue = Math.fround(Math.max(minValue, maxValue));
        this.pixelRange = range;
        this.minTickLevel = 0;
        this.maxTickLevel = this.ticks.length - 1;

        for (let i = this.ticks.length - 1; i >= 0; i--) {
            const ratio = (this.ticks[i] * this.pixelRange) / (this.maxValue - this.minValue);
            this.tickRatios[i] = (ratio - this.minSpacing) / (this.maxSpacing - this.minSpacing);
            if (this.tickRatios[i] >= 1.0) {
                this.maxTickLevel = i;
            }
            if (ratio <= this.minSpacing) {
                this.minTickLevel = i;
                break;
            }
        }

        for (let j = this.minTickLevel; j <= this.maxTickLevel; j++) {
            this.tickRatios[j] = clamp01(this.tickRatios[j]);
        }
        return this;
    }

    ticksAtLevel(level: number, excludeHigherLevel: boolean) {
        const results = [];
        const tick = this.ticks[level];
        const start = Math.floor(this.minValue / tick);
        const end = Math.ceil(this.maxValue / tick);
        for (let i = start; i <= end; i++) {
            if (!excludeHigherLevel || level >= this.maxTickLevel || i % Math.round(this.ticks[level + 1] / tick) !== 0) {
                results.push(i * tick);
            }
        }
        return results;
    }

    levelForStep(step: number) {
        for (let i = 0; i < this.ticks.length; i++) {
            const ratio = (this.ticks[i] * this.pixelRange) / (this.maxValue - this.minValue);
            if (ratio >= step) return i;
        }
        return -1;
    }
}

export default LinearTicks;
