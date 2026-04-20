from fastapi import APIRouter
from pydantic import BaseModel

from model_behavior.bilstm_online import predict_segment_bilstm_online
from model_behavior.predict import predict_segment


router = APIRouter()


class SegmentBody(BaseModel):
    user_id: int
    avg_price: float
    total_spent: float
    purchase_count: int
    fav_category: str


@router.post('/segment')
def segment(body: SegmentBody):
    # Prefer sequence-based BiLSTM prediction when user behavior is available.
    bilstm_result = predict_segment_bilstm_online(body.user_id)
    if bilstm_result:
        bilstm_result['fallback'] = False
        return bilstm_result

    tabular_result = predict_segment(
        avg_price=body.avg_price,
        total_spent=body.total_spent,
        purchase_count=body.purchase_count,
        fav_category=body.fav_category,
    )
    tabular_result['model'] = 'Dense-tabular'
    tabular_result['fallback'] = True
    return tabular_result
