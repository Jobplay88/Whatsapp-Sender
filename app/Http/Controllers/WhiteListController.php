<?php

namespace App\Http\Controllers;

use App\Models\IpWhitelist;
use Illuminate\Http\Request;
use App\Http\Controllers\ApiController;
use Illuminate\Support\Facades\Validator;

class WhiteListController extends ApiController
{
    public function showWhiteLists(Request $request){
        $limit = $request->limit ?? $this->pagination_limit();

        $whitelist = IpWhitelist::paginate($limit);

        return $this->response('success', $whitelist);
    }

    public function handleAddNewWhiteList(Request $request){
        $validator = Validator::make($request->all(), [
            'ip_address' => 'required|ip',
        ]);

        if ($validator->fails()) {
            return $this->response('validationError', ['errors' => $validator->errors()]);
        }

        try {
            $this->begin();

            $whitelist = new IpWhitelist();
            $whitelist->user_id = 0;
            $whitelist->ip_address = $request->ip_address;
            $whitelist->save();

            $this->commit();

            return $this->response('success', '', 'New whitelist added successfully');
        }
        catch (\Exception $e) {
            $this->rollback();
            return $this->response('serverError', $e->getMessage());
        }
    }

    public function handleDeleteWhiteList(Request $request){
        $validator = Validator::make($request->all(), [
            'id' => 'required',
        ]);

        if ($validator->fails()) {
            return $this->response('validationError', ['errors' => $validator->errors()]);
        }

        try {
            $this->begin();

            $whitelist = IpWhitelist::find($request->id);
            $whitelist->delete();

            $this->commit();

            return $this->response('success', '', 'Whitelist deleted successfully');
        }
        catch (\Exception $e) {
            $this->rollback();
            return $this->response('serverError', $e->getMessage());
        }
    }
}
