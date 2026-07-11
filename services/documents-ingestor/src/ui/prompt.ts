import { createInterface } from 'node:readline/promises';

export async function confirmAction(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${message} (s/N) `);
  rl.close();
  return answer.trim().toLowerCase() === 's';
}

export async function promptPedido(): Promise<string | null> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('Informe o número do Pedido (ex: 25/2026 ou PED-25-2026): ');
  rl.close();
  return answer.trim() || null;
}
