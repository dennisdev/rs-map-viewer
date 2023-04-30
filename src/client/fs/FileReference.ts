export class FileReference {
    constructor(
        public readonly id: number,
        public readonly archiveId: number,
        public readonly nameHash: number
    ) {}
}
