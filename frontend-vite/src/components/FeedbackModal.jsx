import React, { useState } from 'react';
import { X, ThumbsUp, ThumbsDown } from 'lucide-react';
import UIButton from './common/UIButton';
import { API_BASE } from '../config/appConfig';

export default function FeedbackModal({ 
  isOpen, 
  onClose, 
  summaryText, 
  docId 
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submitFeedback = async (feedback) => {
    if (!docId || submitted) return;
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch(`${API_BASE}/api/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          doc_id: docId,
          feedback: feedback,
          summary: summaryText
        })
      });

      if (response.ok) {
        // 성공 시 localStorage에 기록
        localStorage.setItem(`feedback_given:${docId}`, 'true');
        setSubmitted(true);
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        throw new Error('Feedback submission failed');
      }
    } catch (error) {
      console.error('Feedback submission error:', error);
      
      // 실패 시 큐에 저장
      const queue = JSON.parse(localStorage.getItem('feedback_queue') || '[]');
      queue.push({
        doc_id: docId,
        feedback: feedback,
        summary: summaryText,
        timestamp: Date.now()
      });
      localStorage.setItem('feedback_queue', JSON.stringify(queue));
      
      // 사용자에게 알림
      alert('피드백 전송에 실패했습니다. 나중에 다시 시도됩니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[1000] flex items-end justify-center p-4"
      onClick={onClose}
    >
             <div 
         className="bg-white rounded-2xl shadow-xl w-[92vw] max-w-md mb-24"
         style={{ marginBottom: `calc(6rem + env(safe-area-inset-bottom))` }}
         onClick={(e) => e.stopPropagation()}
       >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">요약, 괜찮았나요?</h2>
          <UIButton
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            disabled={isSubmitting}
          >
            <X size={20} className="text-gray-500" />
          </UIButton>
        </div>

        {/* 내용 */}
        <div className="p-4">
          {submitted ? (
            <div className="text-center py-6">
              <div className="text-green-500 text-5xl mb-3">✓</div>
              <p className="text-gray-700 font-medium">피드백이 전송되었습니다!</p>
            </div>
          ) : (
            <>
              <div className="mb-3">
                <div className="grid grid-cols-2 gap-3">
                  <UIButton
                    onClick={() => submitFeedback('positive')}
                    disabled={isSubmitting}
                    className="h-12 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
                  >
                    <ThumbsUp size={18} />
                    괜찮아요
                  </UIButton>
                  <UIButton
                    onClick={() => submitFeedback('negative')}
                    disabled={isSubmitting}
                    className="h-12 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
                  >
                    <ThumbsDown size={18} />
                    바꿔주세요
                  </UIButton>
                </div>
              </div>

              <div className="text-center">
                <p className="text-xs text-gray-500">이 선택은 서비스 품질 향상에 사용됩니다.</p>
              </div>

              {isSubmitting && (
                <div className="text-center py-2">
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600"></div>
                  <span className="ml-2 text-sm text-gray-500">전송 중...</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
