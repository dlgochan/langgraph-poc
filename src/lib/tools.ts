/**
 * 호텔 챗봇 도구 정의
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * 객실 검색 (안전 - 바로 실행)
 */
export const searchRooms = tool(
  async ({ checkIn, checkOut, guests }) => {
    // 실제로는 DB 조회
    const rooms = [
      { id: 'R101', type: '스탠다드', price: 100000, available: true },
      { id: 'R201', type: '디럭스', price: 150000, available: true },
      { id: 'R301', type: '스위트', price: 250000, available: true },
    ];

    return JSON.stringify({
      checkIn,
      checkOut,
      guests,
      availableRooms: rooms,
    });
  },
  {
    name: 'searchRooms',
    description: '호텔 객실을 검색합니다. 체크인/체크아웃 날짜와 인원수로 검색합니다.',
    schema: z.object({
      checkIn: z.string().describe('체크인 날짜 (YYYY-MM-DD)'),
      checkOut: z.string().describe('체크아웃 날짜 (YYYY-MM-DD)'),
      guests: z.number().describe('투숙 인원'),
    }),
  }
);

/**
 * 예약 조회 (안전 - 바로 실행)
 */
export const getReservation = tool(
  async ({ reservationId }) => {
    // 실제로는 DB 조회
    return JSON.stringify({
      reservationId,
      guestName: '홍길동',
      roomType: '디럭스',
      checkIn: '2024-03-15',
      checkOut: '2024-03-17',
      totalPrice: 300000,
      status: '확정',
    });
  },
  {
    name: 'getReservation',
    description: '예약 정보를 조회합니다.',
    schema: z.object({
      reservationId: z.string().describe('예약 번호'),
    }),
  }
);

/**
 * 객실 예약 (위험 - 승인 필요)
 */
export const bookRoom = tool(
  async ({ roomId, checkIn, checkOut, guestName, guestPhone }) => {
    // 실제로는 DB에 예약 생성 + 결제 처리
    const reservationId = `RSV${Date.now()}`;

    return JSON.stringify({
      success: true,
      reservationId,
      roomId,
      guestName,
      checkIn,
      checkOut,
      message: `예약이 완료되었습니다. 예약번호: ${reservationId}`,
    });
  },
  {
    name: 'bookRoom',
    description: '객실을 예약합니다. 결제가 진행됩니다.',
    schema: z.object({
      roomId: z.string().describe('객실 ID'),
      checkIn: z.string().describe('체크인 날짜 (YYYY-MM-DD)'),
      checkOut: z.string().describe('체크아웃 날짜 (YYYY-MM-DD)'),
      guestName: z.string().describe('투숙객 이름'),
      guestPhone: z.string().describe('투숙객 연락처'),
    }),
  }
);

/**
 * 예약 취소 (위험 - 승인 필요)
 */
export const cancelReservation = tool(
  async ({ reservationId, reason }) => {
    // 실제로는 DB에서 예약 취소 + 환불 처리
    return JSON.stringify({
      success: true,
      reservationId,
      refundAmount: 300000,
      message: `예약이 취소되었습니다. 환불금액: 300,000원`,
    });
  },
  {
    name: 'cancelReservation',
    description: '예약을 취소합니다. 취소 수수료가 발생할 수 있습니다.',
    schema: z.object({
      reservationId: z.string().describe('예약 번호'),
      reason: z.string().optional().describe('취소 사유'),
    }),
  }
);

// 모든 도구
export const allTools = [searchRooms, getReservation, bookRoom, cancelReservation];

// 위험한 도구 (승인 필요)
export const dangerousToolNames = ['bookRoom', 'cancelReservation'];

export function isDangerousTool(toolName: string): boolean {
  return dangerousToolNames.includes(toolName);
}
