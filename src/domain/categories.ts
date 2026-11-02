import {
  BookOpen,
  Dumbbell,
  Languages,
  Lightbulb,
  MessageCircle,
  Utensils,
  type LucideIcon,
} from 'lucide-react';
import type { Category } from './types';

export interface CategoryMeta {
  key: Category;
  label: string;
  placeholder: string;
  icon: LucideIcon;
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  exercise: {
    key: 'exercise',
    label: '运动',
    placeholder: '今天做了什么运动？',
    icon: Dumbbell,
  },
  reading: {
    key: 'reading',
    label: '看书',
    placeholder: '今天读了什么？',
    icon: BookOpen,
  },
  eating: {
    key: 'eating',
    label: '好好吃饭',
    placeholder: '今天吃得怎么样？',
    icon: Utensils,
  },
  deepTalk: {
    key: 'deepTalk',
    label: '深谈',
    placeholder: '和谁进行了有意义的交流？',
    icon: MessageCircle,
  },
  english: {
    key: 'english',
    label: '英语学习',
    placeholder: '今天学了什么英语？',
    icon: Languages,
  },
  thinking: {
    key: 'thinking',
    label: '今日思考',
    placeholder: '今天有什么值得记下的想法？',
    icon: Lightbulb,
  },
};

/** Fixed display order for the six dimensions, shared by every page. */
export const CATEGORY_ORDER = Object.values(CATEGORY_META);
