from kstock_sidecar.protocol import Request, Response


def test_request_defaults_to_empty_params():
    request = Request.model_validate_json('{"id":"1","method":"health"}')
    assert request.id == "1"
    assert request.method == "health"
    assert request.params == {}


def test_response_can_carry_error():
    response = Response(id="1", ok=False, error="出错了")
    assert response.id == "1"
    assert response.ok is False
    assert response.error == "出错了"
