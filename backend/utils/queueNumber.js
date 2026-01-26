import prisma from '../db.js';

/**
 * Generate a queue number with format: MMDDYY-XXXX
 * MMDDYY = date prefix (e.g., 012526 for Jan 25, 2026)
 * XXXX = 4-digit daily counter starting at 1
 */
export async function generateQueueNumber() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);
  const datePrefix = `${month}${day}${year}`;
  const dateKey = `${now.getFullYear()}-${month}-${day}`;

  // Use a transaction to ensure atomicity and prevent race conditions
  const result = await prisma.$transaction(async (tx) => {
    // Try to get or create the daily counter
    let dailyCounter = await tx.dailyCounter.findUnique({
      where: { date: dateKey },
    });

    if (!dailyCounter) {
      // Create new counter for today
      dailyCounter = await tx.dailyCounter.create({
        data: {
          date: dateKey,
          counter: 0,
        },
      });
    }

    // Increment counter atomically
    const updated = await tx.dailyCounter.update({
      where: { date: dateKey },
      data: {
        counter: {
          increment: 1,
        },
      },
    });

    // Format queue number
    const counterStr = String(updated.counter).padStart(4, '0');
    const queueNumber = `${datePrefix}-${counterStr}`;

    return queueNumber;
  }, {
    isolationLevel: 'Serializable', // Highest isolation level for concurrency safety
  });

  return result;
}
