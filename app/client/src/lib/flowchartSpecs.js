/**
 * 流程图类题目的可视化定义（只描述题面已给出的信息，不含答案）。
 * 题库为锁库只读，视觉结构集中在此，便于后续题目按同一方式扩展。
 */
export const FLOWCHARTS = {
  // GM09 台灯控制流程图残局：两个出口接反
  GM09: {
    kind: 'branch',
    badge: '流程图残局',
    start: '输入开关指令',
    decision: '指令是「开」？',
    yes: { label: '是', text: '台灯不亮' },
    no: { label: '否', text: '台灯亮' },
  },
  // GC05 展柜加湿：两个条件同时成立才启动
  GC05: {
    kind: 'andGate',
    badge: '规则示意',
    conditions: ['湿度低于40', '柜门已关'],
    op: '与',
    action: '启动加湿',
  },
};
