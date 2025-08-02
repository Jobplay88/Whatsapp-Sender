<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use App\Http\Controllers\ApiController;

class UserController extends ApiController
{
    public function showUserList(Request $request) {
        $users = User::all();

        return $this->response('success', $users);
    }
}
