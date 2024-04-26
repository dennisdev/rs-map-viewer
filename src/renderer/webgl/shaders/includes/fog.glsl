float fogFactorLinear(float dist, float start, float end) {
    return 1.0 - clamp((dist - start) / (end - start), 0.0, 1.0);
}

float sdRoundedBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}
