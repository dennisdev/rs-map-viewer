float when_eq(float x, float y) {
    return 1.0 - abs(sign(x - y));
}

float when_neq(float x, float y) {
    return abs(sign(x - y));
}

float when_lt(float x, float y) {
    return max(sign(y - x), 0.0);
}

float or(float a, float b) {
    return min(a + b, 1.0);
}
