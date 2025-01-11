<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\WhatsappService;
use App\Http\Controllers\ApiController;
use Illuminate\Support\Facades\Validator;

class PhoneSessionController extends ApiController
{
    public function showPhoneSessionList()
    {
        $phoneSessions = WhatsappService::where('status', 'active')->get();

        return $this->response('success', '', $phoneSessions);
    }
    public function handleAddNewPhoneSession(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required',
            'number' => 'required',
        ]);

        if ($validator->fails()) {
    		return $this->response('validationError', ['errors' => $validator->errors()]);
        }

        try {
            $this->begin();

            $phoneSession = new WhatsappService();
            $phoneSession->user_id = 0;
            $phoneSession->name = $request->name;
            $phoneSession->number = $request->number;
            $phoneSession->status = 'active';
            $phoneSession->save();

            $this->commit();

            return $this->response('success', '', 'New phone session added successfully');
        }
        catch (\Exception $e) {
            $this->rollback();
            return $this->response('error', $e->getMessage());
        }
    }

    public function handleDeletePhoneSession(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id' => 'required',
        ]);

        if ($validator->fails()) {
            return $this->response('error', $validator->errors());
        }

        try {
            $this->begin();

            $phoneSession = WhatsappService::find($request->id);
            $phoneSession->delete();    

            $this->commit();    

            return $this->response('success', '', 'Phone session deleted successfully');
        }
        catch (\Exception $e) {
            $this->rollback();
            return $this->response('error', $e->getMessage());
        }
    }
}
