import { v4 as uuidv4 } from 'uuid';

/**
 * 生成 UUID v4 字符串
 * 用于所有实体的主键生成，替代原自增 number ID
 */
export function generateId(): string {
  return uuidv4();
}
