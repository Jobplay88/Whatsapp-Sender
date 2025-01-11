<?php

namespace App\Traits;

trait ApiResponser{

	/*
	 * Process the JSON response with the following status
	 * e.g. success, error, and warning
	 */
    protected static function response($status, $data = [], $message = null, $code = 200, $additionalData = [], $headers = [])
	{
		if ($status === 'error') {
			$code = 400;
		}
		
		if ($status === 'unauthorized') {
			$code = 401;
		}

		if ($status === 'forbidden') {
			$code = 403;
		}

		if ($status === 'validationError') {
			$code = 422;
		}

		if ($status === 'requestError') {
			$code = 429;
		}
		
		if ($status === 'serverError') {
			$code = 500;
		}

		if ($status === 'serverUnavailable') {
			$code = 503;
		}

		// Proceed here if the headers argument data exist
		if ($headers) {
			return response()->json($data, $code, $headers);
		}

		// $token = '';
		$userOptions = [];
		$user = auth()->user();

		$data = self::formatResponseData($data, $additionalData);

		// retrieve the user access token
		if (!is_null($user) && $user->id) {

			$userOptions = [
				'user' => [
					"id" => $user->id,
					"email" => $user->name
				]
			];
		}

		$data = array_merge($userOptions, $data);

		$defaultOptions = [
			'status' => $code,
			'message' => $message,
			'data' => $data
		];

		return response()->json($defaultOptions, $code);
	}

	/**
	 * Format the additional data into the JSON response data
	*/
	protected static function formatResponseData($data = [], $additionalData = [])
	{
		$items = [];
		$isObjectPagination = false;
		$origData = $data;

		// Check if the object is related to the pagination 
		if ($origData && !is_array($origData) && $origData instanceof \Illuminate\Pagination\LengthAwarePaginator) {
			$items = $origData->items();
			$isObjectPagination = true;

		} else {
			// Assign back to the original data if the object is not related to the pagination 
			$items = $origData;
		}

		$formattedData = [
			"result" => [
				"totalPages" => 0,
				"totalRows" => 0,
				"content" => $items
			]
		];

		if (!$items) {
			return $formattedData;
		}

		// Format pagination data 
		$paginationData = self::formatPaginationData($origData, $isObjectPagination, $additionalData);

		// Map the pagination data into the result
		$totalRows = isset($paginationData['totalRows']) && $paginationData['totalRows'] ? $paginationData['totalRows'] : '';
		$totalPages = isset($paginationData['totalPages']) && $paginationData['totalPages'] ? $paginationData['totalPages'] : '';

		if ($totalRows) {
			$formattedData['result']['totalRows'] = $totalRows;
		}

		if ($totalPages) {
			$formattedData['result']['totalPages'] = $totalPages;
		}

		return $formattedData;
	}

    /**
     * Merge array data for display pagination response data currently
    */
    protected static function formatPaginationData($data, $isObjectPagination = false, $additionalData = [])
    {
		$output = [];

		if (!$isObjectPagination && !$additionalData) {
			return $output;
		}

		if ($isObjectPagination) {
			// total (total of the items)
			// perPage (total of item per page)
			// lastPage (last pagination number)
			// currentPage (what is the current page)

			$totalRows = $data->total();
			$perPage = $data->perPage();
			$lastPage = $data->lastPage();
			$currentPage = $data->currentPage();

		} else {
			// If the data object is not related to the paginate then this checking is use to check for manually assign the value
			$totalRows = isset($additionalData['totalRows']) && $additionalData['totalRows'] ? $additionalData['totalRows'] : '';
			$perPage = isset($additionalData['perPage']) && $additionalData['perPage'] ? $additionalData['perPage'] : '';
		}

		$output = self::formatTotalCount($totalRows, $perPage);

        return $output;
    }

    protected static function formatTotalCount($totalCount = 0, $limit = 20)
    {
        $totalPages = 0;
		$limit = !$limit || $limit == 0 ? 20 : $limit; 

        // Required to return how many pagination page need to render on the frontend
        if ($totalCount > 0) {
            $totalPages = ceil((int) $totalCount / (int) $limit);
        }

        $output['totalPages'] = (int) $totalPages;
        $output['totalRows'] = (int) $totalCount;

        return $output;
    }
}