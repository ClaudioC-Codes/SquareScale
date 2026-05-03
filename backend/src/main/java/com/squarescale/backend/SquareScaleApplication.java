package com.squarescale.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** Entry point: starts the REST API and connects to the configured database (e.g. MySQL). */
@SpringBootApplication
public class SquareScaleApplication {

	public static void main(String[] args) {
		SpringApplication.run(SquareScaleApplication.class, args);
	}

}
