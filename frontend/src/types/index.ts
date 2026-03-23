export interface Team {
  id: number;
  name: string;
  created_at: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  is_admin: boolean;
  is_virtual: boolean;
  team_id: number | null;
  created_at: string;
}

export interface Schedule {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  cycle_start_time: string;
  shift_duration_hours: number;
  capacity: number;
  primary_team_id: number;
  timezone: string;
  created_at: string;
  primary_team?: Team | null;
}

export interface Shift {
  id: number;
  schedule_id: number;
  start_datetime: string;
  end_datetime: string;
  index: number;
}

export type ShiftState = 'in_shift' | 'available' | 'home';

export interface ShiftUserState {
  shift_id: number;
  state: ShiftState;
  has_pending_request: boolean;
}

export interface MemberRow {
  user: User;
  team: Team | null;
  is_fill_in: boolean;
  states: ShiftUserState[];
}

export interface ShiftStat {
  shift_id: number;
  in_shift_count: number;
  capacity: number;
}

export interface GridData {
  schedule: Schedule;
  shifts: Shift[];
  members: MemberRow[];
  shift_stats: ShiftStat[];
}

export type HomeDecision = 'pending' | 'approved' | 'rejected';
export type RequestStatus = 'pending' | 'partial' | 'approved' | 'rejected';

export interface HomeRequestShiftItem {
  id: number;
  shift_id: number;
  decision: HomeDecision;
  shift: Shift;
}

export interface HomeRequest {
  request_id: string;
  user_id: number;
  schedule_id: number;
  schedule_timezone: string;
  created_at: string;
  status: RequestStatus;
  shifts: HomeRequestShiftItem[];
}

export interface Notification {
  id: number;
  user_id: number;
  created_at: string;
  type: string;
  payload_json: Record<string, unknown> | null;
  is_read: boolean;
}

export interface AuditLog {
  id: number;
  created_at: string;
  actor_user_id: number | null;
  affected_user_id: number | null;
  schedule_id: number | null;
  shift_id: number | null;
  action: string;
  old_value_json: unknown;
  new_value_json: unknown;
}
