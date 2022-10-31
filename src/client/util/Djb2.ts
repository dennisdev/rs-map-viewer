export class Djb2 {
    // An implementation of Dan Bernstein's {@code djb2} hash function which is
	// slightly modified. Instead of the initial hash being 5381, it is zero.
    public static hash(str: string): number {
        let hash = 0;
        if (str.length === 0) {
            return hash;
        }
        let char;
        for (let i = 0; i < str.length; i++) {
            char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
    }
}
