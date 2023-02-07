float unpackFloat16(int v) {
    int exponent = v >> 10;
    float mantissa = float(v & 0x3FF) / 1024.0;
    return float(exponent) + mantissa;
}

float unpackFloat12(uint v) {
    return 16.0 - float(v) / 128.0;
}

float unpackFloat11(uint v) {
    return 16.0 - float(v) / 64.0;
}

float unpackFloat11(int v) {
    return 16.0 - float(v) / 64.0;
}

float unpackFloat6(uint v) {
    return float(v) / 63.0;
}

float unpackFloat6(int v) {
    return float(v) / 63.0;
}
