import { API_BASE } from '../config/appConfig';

export async function flushFeedbackQueue() {
  try {
    const queue = JSON.parse(localStorage.getItem('feedback_queue') || '[]');
    
    if (queue.length === 0) {
      return;
    }

    console.log(`Processing ${queue.length} queued feedback items...`);

    const successfulItems = [];
    const failedItems = [];

    // 각 큐 아이템을 순차적으로 처리
    for (const item of queue) {
      try {
        const response = await fetch(`${API_BASE}/api/feedback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            doc_id: item.doc_id,
            feedback: item.feedback,
            summary: item.summary
          })
        });

        if (response.ok) {
          successfulItems.push(item);
          console.log(`Successfully sent feedback for doc_id: ${item.doc_id}`);
        } else {
          failedItems.push(item);
          console.warn(`Failed to send feedback for doc_id: ${item.doc_id}`);
        }
      } catch (error) {
        failedItems.push(item);
        console.error(`Error sending feedback for doc_id: ${item.doc_id}:`, error);
      }
    }

    // 성공한 아이템들을 큐에서 제거하고 실패한 아이템들만 다시 저장
    if (successfulItems.length > 0) {
      console.log(`Successfully processed ${successfulItems.length} feedback items`);
    }

    if (failedItems.length > 0) {
      console.log(`Failed to process ${failedItems.length} feedback items, keeping in queue`);
      localStorage.setItem('feedback_queue', JSON.stringify(failedItems));
    } else {
      // 모든 아이템이 성공했으면 큐를 비움
      localStorage.removeItem('feedback_queue');
    }

    return {
      successful: successfulItems.length,
      failed: failedItems.length
    };

  } catch (error) {
    console.error('Error flushing feedback queue:', error);
    return {
      successful: 0,
      failed: 0,
      error: error.message
    };
  }
}
