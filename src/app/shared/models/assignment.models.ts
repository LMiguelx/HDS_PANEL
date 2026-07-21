export interface AssignmentView {
  assignmentId: number;
  customerId: number;
  customerName: string | null;
  userId: number;
  userName: string | null;
  assignmentType: string;
  effectiveFrom: string; // yyyy-MM-dd
  lastDay: string | null; // null = vigente
  weekdays: number[]; // ISO 1..7
  active: boolean;
}

export interface CreateAssignmentCommand {
  customerId: number;
  userId: number;
  assignmentType: string; // 'SALES'
  effectiveFrom: string; // yyyy-MM-dd
  weekdays: number[]; // ISO 1..7 (vacío = cualquier día)
}
