float when_eq(float x, float y) {
    return 1.0 - abs(sign(x - y));
}

float when_neq(float x, float y) {
    return abs(sign(x - y));
}

float or(float a, float b) {
    return min(a + b, 1.0);
}
