export interface Segment {
  segmentId: number;
  code: string | null;
  name: string;
  segmentType: string; // MANUAL | RULE_BASED
  memberCount?: number;
}

export interface SegmentMember {
  customerId: number;
  businessName: string;
  documentNumber?: string | null;
}

export interface CreateSegmentCommand {
  name: string;
  code?: string;
}
